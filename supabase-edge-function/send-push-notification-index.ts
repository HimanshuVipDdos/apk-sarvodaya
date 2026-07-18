// Supabase Edge Function: send-push-notification
//
// This is called automatically by a Database Webhook every time a new row
// is inserted into `notifications` or a `cbt_tests` row is published — so
// students get a real push alert on their phone, the same moment the admin
// adds it from the admin panel. No admin-side code changes needed.
//
// Deploy: Supabase Dashboard -> Edge Functions -> Deploy new function ->
// name it "send-push-notification" -> paste this file -> Deploy.
// Then set up the trigger (SQL below, or Dashboard -> Database -> Webhooks).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    // Database Webhooks send { type, table, record, old_record }
    const record = payload.record ?? payload;
    const table = payload.table as string | undefined;

    let title = "Sarvodaya Adhyeta";
    let body = "You have a new update.";

    if (table === "notifications" || record?.message !== undefined) {
      title = record.title ?? "New Notice";
      body = record.message ?? "Tap to view details.";
    } else if (table === "cbt_tests" || record?.duration_minutes !== undefined) {
      // Only notify when a test is actually published, not on every draft save.
      if (record?.is_published !== true) {
        return new Response(JSON.stringify({ skipped: "not published" }), { status: 200 });
      }
      title = "New Test Available";
      body = record.title ?? "A new test has been added.";
    } else if (record?.youtube_url !== undefined || record?.is_live !== undefined) {
      if (record?.is_live !== true) {
        return new Response(JSON.stringify({ skipped: "not live yet" }), { status: 200 });
      }
      title = "🔴 Live Class Started";
      body = record.title ?? "Your class has started.";
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Send to everyone (notices/new tests are broadcast-wide). If you later
    // want batch-specific targeting, join device_push_tokens -> enrollments
    // here instead of selecting every token.
    const { data: tokens, error } = await admin.from("device_push_tokens").select("expo_push_token");
    if (error) throw new Error(error.message);
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    // Expo's push API accepts up to 100 messages per request.
    const messages = tokens.map((t: { expo_push_token: string }) => ({
      to: t.expo_push_token,
      sound: "default",
      title,
      body,
      priority: "high",
    }));

    const chunks: typeof messages[] = [];
    for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));

    for (const chunk of chunks) {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
    }

    return new Response(JSON.stringify({ sent: messages.length }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), {
      status: 500,
    });
  }
});
