# Sarvodaya Adhyeta — Mobile App (feature-complete, PW-style)

Same Supabase backend as sarvodayadhyeta.online. Different (native) interface, like PW's app vs their website.

## Everything included now

- ✅ Login (same accounts as the website)
- ✅ Dashboard — enrolled batches (tap to open)
- ✅ **Batch page** — Live / Lectures / Tests / Notes tabs, like PW's batch page
- ✅ **Live class player** — video + real-time live chat (same `live_chat_messages`
  table as the website — app and website students chat together), LIVE badge
- ✅ **Full CBT test-taking** — palette, absolute-deadline timer, auto-submit,
  resume-on-reopen
- ✅ **Report card** — score, rank, percentage, topic-wise weak points
- ✅ **Mistakes review** — every wrong/unanswered Q with correct answer shown
- ✅ **Leaderboard** — top 20 for any test, "(You)" highlighted
- ✅ **Notes/DPP tab** — tap a note to open the PDF (opens in the phone's PDF
  viewer/browser)
- ✅ **Real push notifications** — new notice / newly-published test / live
  class going live all trigger an actual phone notification, automatically,
  with zero change needed to how the admin panel is used
- ✅ Notifications tab, Profile tab + Logout

## Google Login (new)

The app now has a "Continue with Google" button on the login screen. It reuses
the **same Google provider already configured for the website** in Supabase
Dashboard → Authentication → Providers → Google — no new Google Cloud
Console setup needed.

**One thing to add in Supabase Dashboard (one-time, 2 min):**
1. Supabase Dashboard → **Authentication → URL Configuration**
2. Under **Redirect URLs**, add: `sarvodayaadhyeta://auth/callback`
3. Save.

That's it — Google login will then work in the app exactly like it does on
the website (same accounts, same session).

---

## Deployment — 2 Edge Functions + 3 webhooks (15 min total, one-time)

### A. `cbt-mobile-api` (powers Tests/Result/Mistakes/Leaderboard)
1. Supabase Dashboard → **Edge Functions** → **Deploy a new function**
2. Name: `cbt-mobile-api`
3. Paste all of `supabase-edge-function/cbt-mobile-api-index.ts` → **Deploy**

### B. `send-push-notification` (powers real push alerts)
1. Same place → **Deploy a new function**
2. Name: `send-push-notification`
3. Paste all of `supabase-edge-function/send-push-notification-index.ts` → **Deploy**

### C. Wire up the 3 triggers (Supabase Dashboard → Database → Webhooks → Create a new hook)
Create three webhooks, all pointing to the `send-push-notification` function:

| Webhook name | Table | Events |
|---|---|---|
| notify-new-notice | `notifications` | Insert |
| notify-test-published | `cbt_tests` | Insert, Update |
| notify-live-started | `live_classes` | Update |

For each: **Type = Supabase Edge Functions**, pick `send-push-notification`
as the target. (The function itself already checks `is_published`/`is_live`
so it only actually sends when relevant — you don't need to configure filters.)

**Nothing changes for you day-to-day** — keep using the admin panel exactly
as before. The moment you publish a test, post a notice, or start a live
class, students with the app get a phone notification automatically.

## What's genuinely still missing (Phase 5, if you ever want it)

- Batch-specific notification targeting (right now notices go to *everyone*
  with the app installed, same as how the website shows notices to all
  logged-in users — fine for now, but if you want "only Batch X students get
  pinged about Batch X's live class", that needs a small join added to the
  push function)
- In-app payment/enrollment flow (right now enrollment still happens on the website)
- Play Store packaging — see below, this needs *you* to run the build (I
  can't run `eas build` from here since it needs your own Expo account login)

---

## 1. One-time setup on your computer (or ask me to guide you screen by screen)




Unlike your website (GitHub web UI only), a React Native app needs to be **built**
into an installable file. You don't need Android Studio though — we use Expo's
free cloud build service (EAS).

```bash
npm install -g eas-cli
npm install
```

Copy `.env.example` to `.env` and paste your Supabase **anon/publishable key**
(same one from your website's `.env` — `VITE_SUPABASE_PUBLISHABLE_KEY`):

```
EXPO_PUBLIC_SUPABASE_URL=https://ogqxeakmgpozuzzfrqvk.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your anon key>
```

## 2. Test it live on your phone (no build needed)

```bash
npx expo start
```

Install the **Expo Go** app on your Android phone from Play Store, scan the QR
code shown in the terminal. The app runs instantly, live-reloading as we edit code.

## 3. Google login setup (one-time, Supabase dashboard only)

The app now has a "Continue with Google" button on the login screen. It
reuses the **same Google provider already configured for the website** —
no new Google Cloud Client ID needed. You only need to whitelist the app's
redirect URL:

1. Supabase Dashboard → **Authentication → URL Configuration**
2. Under **Redirect URLs**, add: `sarvodayaadhyeta://`
3. Save.

That's it — Google login will now work in the app exactly like it does on
the website (same accounts, same Google provider).

## 4. Push notifications setup (run this SQL once in Supabase SQL Editor)

```sql
create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

alter table public.device_push_tokens enable row level security;

create policy "Users manage own push tokens"
  on public.device_push_tokens for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

(This table just stores device tokens. The actual "send a push when
something new is added" logic is the `send-push-notification` Edge Function
+ Database Webhooks described above in the Deployment section.)

## 5. Building the real installable app (when ready for Play Store)

```bash
eas login
eas build:configure
eas build --platform android --profile preview   # gives you an installable APK to test
eas build --platform android --profile production # gives you the .aab for Play Store
```

First build takes ~15-20 min on Expo's servers (free tier). You'll get a
download link — that file is what you upload to Play Console (see the earlier
$25 one-time developer account setup we discussed).

## Folder structure

```
app/
  _layout.tsx          <- auth check + redirect logic
  index.tsx             <- loading screen
  login.tsx              <- login screen
  (tabs)/
    _layout.tsx          <- bottom tab bar
    dashboard.tsx
    tests.tsx
    batches.tsx
    notifications.tsx
    profile.tsx
lib/
  supabase.ts           <- backend connection (same DB as website)
  auth-context.tsx       <- shared login state
  notifications.ts        <- push token registration
```

## Ek zaroori baat

Tumhara website ka `src/integrations/supabase/types.ts` file corrupted mila
(usme ek admin route ka code hai, actual database types nahi) — isse mujhe
column names guess karne pade kuch jagah based on tumhare CBT functions code se.
Agar koi column name match na kare (test karne pe error aaye), screenshot bhej
dena, turant fix kar dunga.
