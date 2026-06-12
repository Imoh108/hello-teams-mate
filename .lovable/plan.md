
# QuizPulse — v1 build plan

A web-first, Teams-embeddable real-time quiz app. Managers host moderated rounds; colleagues compete live with strict anti-cheating. Built on Lovable Cloud (auth, database, realtime). Microsoft Teams SSO / manifest / Adaptive Cards / Bot Framework are explicitly **out of v1** — v1 ships a polished web app that can later be wrapped as a Teams tab via iframe manifest.

## What ships in v1

### Roles
- **Manager** (host): creates quizzes, manages question banks, launches/controls live sessions, sees post-game analytics.
- **Player** (colleague): joins a live session via 6-char code, answers questions, sees live leaderboard.

### Features
1. **Auth** — email/password + Google sign-in (Lovable Cloud). Profile with display name + role flag.
2. **Quiz library** — manager creates quizzes grouped by topic pack (Company Trivia, Industry Knowledge, General Culture, Custom). 4 pre-seeded sample packs.
3. **Question editor** — multiple choice (4 options), correct answer, per-question time limit (10–60s).
4. **Live session control panel** — manager starts session → 6-char join code → roster of joined players → start round → per-question controls: start, skip, pause, adjust timer mid-question, reveal answers, next question, end.
5. **Player play screen** — waiting lobby → simultaneous question reveal → countdown timer → answer → locked confirmation → between-question leaderboard.
6. **Live leaderboard** — realtime updates via Supabase Realtime, ranked by points (faster correct = more points).
7. **Strict anti-cheating**:
   - Per-question countdown server-anchored (start timestamp in DB; client trusts server clock).
   - Visibility/blur detection: switching tab or losing focus auto-submits current answer as locked and flags the attempt.
   - Randomized answer-option order per player (seeded by player_id + question_id).
   - One attempt per question per player (DB unique constraint).
   - Manager sees who has answered but not what until reveal.
8. **Post-game analytics (basic)** — per-session: participation rate, per-player score, per-question accuracy, strongest/weakest topic per player.
9. **Design** — focused, energetic, corporate-credible. Not "wellness-soft."

### Pre-seeded content
4 topic packs × ~6 sample questions each, inserted via migration.

## Explicitly out of scope (v1)
- Microsoft Teams app manifest, sideloading, SSO via Entra ID, Adaptive Cards, Bot Framework, Live Share, Graph API, calendar invites, Viva badges, breakout rooms, AppSource listing, billing/tiers. These are large standalone workstreams. v1's web app stands alone and is iframe-embeddable as a Teams tab; we layer the Teams-specific surfaces in follow-up milestones.

## Technical architecture

```
Lovable Cloud (Postgres + Auth + Realtime)
│
├── profiles (id → auth.users, display_name, avatar_url)
├── user_roles (user_id, role: 'manager' | 'player')  ← separate table, has_role() SECURITY DEFINER
├── quizzes (id, owner_id, title, topic_pack, description)
├── questions (id, quiz_id, position, prompt, options[4], correct_index, time_limit_s)
├── sessions (id, quiz_id, host_id, join_code, status: lobby|active|ended,
│              current_question_id, question_started_at, time_limit_override_s)
├── session_players (session_id, user_id, display_name, joined_at, flagged_count)
└── answers (session_id, question_id, user_id, selected_index, answered_at,
            time_taken_ms, is_correct, points, flagged) UNIQUE(session_id, question_id, user_id)
```

RLS everywhere. Roles checked via `has_role(uid, role)` SECURITY DEFINER fn (per project standard — never store role on profile).

Server functions (`createServerFn`):
- `createSession`, `joinSession`, `startQuestion`, `submitAnswer` (server-anchored timing + scoring), `revealAndAdvance`, `endSession`, `flagPlayer`.
- Scoring formula: `correct ? round(1000 * max(0, 1 - elapsed/limit)) + 200 : 0`.

Realtime: clients subscribe to `sessions`, `session_players`, `answers` row changes for the live session.

Routes:
```
/                     marketing landing
/auth                 sign in / sign up
/_authenticated/
  app                  manager dashboard (quiz library + sessions)
  quizzes/$id          quiz editor
  host/$sessionId      manager live control panel
  play                 join by code
  play/$sessionId      player live screen
  results/$sessionId   post-game analytics
```

## Design direction
Dark, focused command-center aesthetic — think Linear meets a Jeopardy! board, not gamified pastel. Tight grid, mono-accent numerals for scores/timers, sharp typography. One bold accent color for "live" state.

## Build order
1. Enable Lovable Cloud, run migration (tables + RLS + `has_role` + seed data).
2. Design system in `src/styles.css` + a few shared components.
3. Auth pages + `_authenticated` gate (integration-managed).
4. Manager: quiz library, quiz editor.
5. Live session: host control panel + player screen + realtime leaderboard + anti-cheat.
6. Post-game results page.
7. Landing page + SEO heads + sitemap.

Confirm and I'll build it.
