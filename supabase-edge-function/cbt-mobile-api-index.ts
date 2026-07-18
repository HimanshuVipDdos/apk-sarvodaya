// Supabase Edge Function: cbt-mobile-api
//
// Purpose: The mobile app cannot use the website's TanStack Start server
// functions directly, and students are (correctly, for security) blocked by
// Row Level Security from reading `cbt_questions` directly — only admins can
// SELECT from that table. So this Edge Function mirrors the exact same logic
// as `src/lib/cbt.functions.ts` on the website, using the service role key,
// and is called over plain HTTPS from the mobile app with the student's
// Supabase login token.
//
// Deploy: Supabase Dashboard -> Edge Functions -> Deploy new function ->
// name it "cbt-mobile-api" -> paste this file as index.ts -> Deploy.
// No extra secrets needed — SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// automatically available to every Edge Function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized: no token" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the token and get the real user id (never trust a client-supplied user_id).
    const authClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized: invalid token" }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json();
    const action = body.action as string;

    // ---------------- start ----------------
    if (action === "start") {
      const testId = body.test_id as string;
      if (!testId) return json({ error: "test_id is required" }, 400);

      const { data: test, error: testErr } = await admin
        .from("cbt_tests")
        .select("id,title,description,duration_minutes,marks_per_question,is_published,access_mode,batch_id,question_limit")
        .eq("id", testId)
        .maybeSingle();
      if (testErr) return json({ error: testErr.message }, 400);
      if (!test || !test.is_published) return json({ error: "This test is not available." }, 400);

      const { data: existing } = await admin
        .from("cbt_attempts")
        .select("id,status,question_ids")
        .eq("test_id", testId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing && existing.status === "submitted") {
        return json({ error: "You have already submitted this test." }, 400);
      }

      let attemptId = existing?.id as string | undefined;
      let questionIds = existing?.question_ids as string[] | null | undefined;

      if (!attemptId) {
        const { data: created, error: insErr } = await admin
          .from("cbt_attempts")
          .insert({ test_id: testId, user_id: userId, status: "in_progress" })
          .select("id")
          .single();
        if (insErr) return json({ error: insErr.message }, 400);
        attemptId = created.id;
      }

      const { data: allQuestions, error: qErr } = await admin
        .from("cbt_questions")
        .select("id,question_text,option_a,option_b,option_c,option_d,marks,sort_order,topic")
        .eq("test_id", testId)
        .order("sort_order", { ascending: true });
      if (qErr) return json({ error: qErr.message }, 400);

      let questions = allQuestions ?? [];

      if (test.question_limit && test.question_limit > 0 && questions.length > test.question_limit) {
        if (!questionIds || questionIds.length === 0) {
          const shuffled = [...questions].sort(() => Math.random() - 0.5);
          questionIds = shuffled.slice(0, test.question_limit).map((q: any) => q.id);
          await admin.from("cbt_attempts").update({ question_ids: questionIds }).eq("id", attemptId);
        }
        const idSet = new Set(questionIds);
        questions = questions.filter((q: any) => idSet.has(q.id));
      }

      return json({
        attempt_id: attemptId,
        test: {
          id: test.id,
          title: test.title,
          description: test.description,
          duration_minutes: test.duration_minutes,
        },
        questions,
      });
    }

    // ---------------- submit ----------------
    if (action === "submit") {
      const attemptId = body.attempt_id as string;
      const answers = body.answers as { question_id: string; selected_option: "a" | "b" | "c" | "d" | null }[];
      if (!attemptId) return json({ error: "attempt_id is required" }, 400);
      if (!Array.isArray(answers)) return json({ error: "answers must be an array" }, 400);

      const { data: attempt, error: attErr } = await admin
        .from("cbt_attempts")
        .select("id,test_id,user_id,status,question_ids")
        .eq("id", attemptId)
        .maybeSingle();
      if (attErr) return json({ error: attErr.message }, 400);
      if (!attempt || attempt.user_id !== userId) return json({ error: "Attempt not found." }, 400);
      if (attempt.status === "submitted") return json({ error: "This test was already submitted." }, 400);

      const { data: test } = await admin
        .from("cbt_tests")
        .select("negative_marking,negative_marks")
        .eq("id", attempt.test_id)
        .maybeSingle();

      const { data: allQuestions, error: qErr } = await admin
        .from("cbt_questions")
        .select("id,correct_option,marks,topic")
        .eq("test_id", attempt.test_id);
      if (qErr) return json({ error: qErr.message }, 400);

      const attemptQuestionIds = attempt.question_ids as string[] | null;
      const questions = attemptQuestionIds && attemptQuestionIds.length > 0
        ? (allQuestions ?? []).filter((q: any) => attemptQuestionIds.includes(q.id))
        : (allQuestions ?? []);

      const negativeMarkingOn = !!test?.negative_marking;
      const negativeMarks = Number(test?.negative_marks ?? 0);

      const answerMap = new Map(answers.map((a) => [a.question_id, a.selected_option]));
      const topicBreakdown: Record<string, { correct: number; wrong: number; unanswered: number }> = {};

      let correctCount = 0, wrongCount = 0, unansweredCount = 0, score = 0, maxScore = 0;
      const answerRows: any[] = [];

      for (const q of questions as any[]) {
        const topic = q.topic || "General";
        topicBreakdown[topic] ??= { correct: 0, wrong: 0, unanswered: 0 };
        maxScore += Number(q.marks ?? 1);

        const selected = answerMap.get(q.id) ?? null;
        const isCorrect = selected != null && selected === q.correct_option;

        if (selected == null) {
          unansweredCount += 1;
          topicBreakdown[topic].unanswered += 1;
        } else if (isCorrect) {
          correctCount += 1;
          score += Number(q.marks ?? 1);
          topicBreakdown[topic].correct += 1;
        } else {
          wrongCount += 1;
          if (negativeMarkingOn) score -= negativeMarks;
          topicBreakdown[topic].wrong += 1;
        }

        answerRows.push({
          attempt_id: attempt.id,
          question_id: q.id,
          selected_option: selected,
          is_correct: isCorrect,
        });
      }

      score = Math.round(score * 100) / 100;
      score = Math.max(0, score);

      if (answerRows.length > 0) {
        const { error: ansErr } = await admin.from("cbt_answers").upsert(answerRows, { onConflict: "attempt_id,question_id" });
        if (ansErr) return json({ error: ansErr.message }, 400);
      }

      const { error: updErr } = await admin
        .from("cbt_attempts")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
          total_questions: questions.length,
          correct_count: correctCount,
          wrong_count: wrongCount,
          unanswered_count: unansweredCount,
          score,
          max_score: maxScore,
          topic_breakdown: topicBreakdown,
        })
        .eq("id", attempt.id);
      if (updErr) return json({ error: updErr.message }, 400);

      return json({ attempt_id: attempt.id });
    }

    // ---------------- result ----------------
    if (action === "result") {
      const attemptId = body.attempt_id as string;
      if (!attemptId) return json({ error: "attempt_id is required" }, 400);

      const { data: attempt, error } = await admin
        .from("cbt_attempts")
        .select("*, test:cbt_tests(id,title,marks_per_question)")
        .eq("id", attemptId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      if (!attempt || attempt.user_id !== userId) return json({ error: "Result not found." }, 400);
      if (attempt.status !== "submitted") return json({ error: "Test not submitted yet." }, 400);

      const { data: profile } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();

      const { count: totalParticipants } = await admin
        .from("cbt_attempts")
        .select("id", { count: "exact", head: true })
        .eq("test_id", attempt.test_id)
        .eq("status", "submitted");

      const { count: higherScores } = await admin
        .from("cbt_attempts")
        .select("id", { count: "exact", head: true })
        .eq("test_id", attempt.test_id)
        .eq("status", "submitted")
        .gt("score", attempt.score);

      const rank = (higherScores ?? 0) + 1;

      const { data: answers } = await admin
        .from("cbt_answers")
        .select("selected_option,is_correct,question:cbt_questions(id,question_text,option_a,option_b,option_c,option_d,correct_option,topic)")
        .eq("attempt_id", attempt.id);

      const mapAnswer = (a: any) => ({
        question_text: a.question?.question_text,
        option_a: a.question?.option_a,
        option_b: a.question?.option_b,
        option_c: a.question?.option_c,
        option_d: a.question?.option_d,
        correct_option: a.question?.correct_option,
        selected_option: a.selected_option,
        is_correct: a.is_correct,
        topic: a.question?.topic || "General",
      });

      const allAnswers = (answers ?? []).map(mapAnswer);
      const mistakes = allAnswers.filter((a) => !a.is_correct);

      return json({
        attempt,
        student_name: profile?.full_name ?? "Student",
        rank,
        total_participants: totalParticipants ?? 0,
        mistakes,
        all_answers: allAnswers,
      });
    }

    // ---------------- leaderboard (public top 20) ----------------
    if (action === "leaderboard") {
      const testId = body.test_id as string;
      if (!testId) return json({ error: "test_id is required" }, 400);

      const { data: test } = await admin.from("cbt_tests").select("id,title").eq("id", testId).maybeSingle();
      if (!test) return json({ error: "Test not found." }, 400);

      const { data: attempts, error } = await admin
        .from("cbt_attempts")
        .select("id,user_id,score,max_score,correct_count,submitted_at")
        .eq("test_id", testId)
        .eq("status", "submitted")
        .order("score", { ascending: false })
        .order("submitted_at", { ascending: true })
        .limit(20);
      if (error) return json({ error: error.message }, 400);

      const userIds = [...new Set((attempts ?? []).map((a: any) => a.user_id))];
      const { data: profiles } = userIds.length
        ? await admin.from("profiles").select("id,full_name").in("id", userIds)
        : { data: [] };
      const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

      return json({
        test_title: test.title,
        entries: (attempts ?? []).map((a: any, i: number) => ({
          rank: i + 1,
          name: nameById.get(a.user_id) ?? "Student",
          score: a.score,
          max_score: a.max_score,
          is_me: a.user_id === userId,
        })),
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
