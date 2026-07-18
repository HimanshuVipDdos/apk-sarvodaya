// Talks to the `cbt-mobile-api` Supabase Edge Function (see
// /supabase-edge-functions/cbt-mobile-api/index.ts for the backend code you
// need to deploy once from the Supabase Dashboard).
import { supabase } from "./supabase";

async function callCbtApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not logged in.");

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/cbt-mobile-api`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
  return json as T;
}

export type CbtQuestion = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  marks: number;
  topic: string | null;
};

export type StartAttemptResponse = {
  attempt_id: string;
  test: { id: string; title: string; description: string | null; duration_minutes: number | null };
  questions: CbtQuestion[];
};

export type SubmitAnswer = { question_id: string; selected_option: "a" | "b" | "c" | "d" | null };

export type ResultResponse = {
  attempt: {
    test_id: string;
    score: number;
    max_score: number;
    correct_count: number;
    wrong_count: number;
    unanswered_count: number;
    submitted_at: string;
    test: { title: string };
    topic_breakdown: Record<string, { correct: number; wrong: number; unanswered: number }>;
  };
  student_name: string;
  rank: number;
  total_participants: number;
  mistakes: {
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: string;
    selected_option: string | null;
    topic: string;
  }[];
};

export function startCbtAttempt(testId: string) {
  return callCbtApi<StartAttemptResponse>("start", { test_id: testId });
}

export function submitCbtAttempt(attemptId: string, answers: SubmitAnswer[]) {
  return callCbtApi<{ attempt_id: string }>("submit", { attempt_id: attemptId, answers });
}

export type LeaderboardEntry = { rank: number; name: string; score: number; max_score: number; is_me: boolean };
export type LeaderboardResponse = { test_title: string; entries: LeaderboardEntry[] };

export function getCbtAttemptResult(attemptId: string) {
  return callCbtApi<ResultResponse>("result", { attempt_id: attemptId });
}

export type LeaderboardEntry = { rank: number; name: string; score: number; max_score: number; is_me: boolean };
export type LeaderboardResponse = { test_title: string; entries: LeaderboardEntry[] };

export function getCbtLeaderboard(testId: string) {
  return callCbtApi<LeaderboardResponse>("leaderboard", { test_id: testId });
}

export function getCbtLeaderboard(testId: string) {
  return callCbtApi<LeaderboardResponse>("leaderboard", { test_id: testId });
}
