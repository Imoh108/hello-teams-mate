# Kahoot-style Quiz Overhaul — Plan

Transform the quiz experience to mimic Kahoot! while keeping the database schema, auth, orgs, admin, and all non-quiz features untouched. Scope is limited to: player screen, host screen, results screen, the join page, the profile page, and a couple of shared visual primitives.

## 1. Scoring change (small backend tweak, no schema change)

File: `src/lib/scoring.ts`
- Replace `computePoints` with Kahoot curve: correct answers get `1000` at t=0 ticking **linearly down to 500** at the buzzer; incorrect = 0. Used by `submitAnswer` in `src/lib/quiz.functions.ts` automatically (same signature).
- Keep `permutationFor` for per-player shuffle.

Streaks:
- Add a lightweight client-side streak counter on the player screen (consecutive correct answers in the current session) and surface it as a flame badge on the leaderboard. No DB column needed for in-session streaks.
- For the profile "Highest Streak" stat, compute on the fly from existing `answers` rows ordered by `created_at` per user (no migration).

## 2. New shared visual primitives

New files under `src/components/quiz/`:
- `AnswerBlock.tsx` — the 4 color blocks. Fixed mapping by display index:
  - 0 → red, Triangle (lucide `Triangle`)
  - 1 → blue, Diamond (lucide `Diamond`)
  - 2 → yellow, Circle (lucide `Circle`)
  - 3 → green, Square (lucide `Square`)
  - Thick border, heavy shadow, large radius, hover `scale-[1.02]`, active `scale-[0.97]`, disabled/locked dimming, reveal state (correct → glow, incorrect picked → shake).
- `CircularTimer.tsx` — SVG ring countdown bound to `remaining/limit`, large center number, color shifts amber under 5s / red under 2s, smooth `transition` on `stroke-dashoffset`.
- `FeedbackOverlay.tsx` — full-screen vibrant green ✓ "Correct! +points" or red ✗ "Incorrect" with scale-in animation, auto-fades.
- `PodiumLeaderboard.tsx` — top-3 podium + scrolling rows 4–10; uses Framer Motion `layout` so rows animate when positions change; flame icon when `streak >= 2`.

New Tailwind tokens added to `src/styles.css` under `@theme` (semantic, not hardcoded):
- `--color-kahoot-red`, `--color-kahoot-blue`, `--color-kahoot-yellow`, `--color-kahoot-green` and matching `*-foreground` for contrast.
- `--shadow-kahoot` (heavy bottom shadow used by blocks/cards).
- `--radius-kahoot` (extra-large radius).

Framer Motion is already in the stack (used by other routes); no new deps expected. If missing, install `framer-motion` in build mode.

## 3. Player screen rewrite — `src/routes/_authenticated/play.$sessionId.tsx` + `src/routes/play.index.tsx`

Game loop driven by session state we already get over realtime (`status`, `current_question_id`, `question_started_at`). Introduce a small client phase machine on top:

```
lobby  →  countdown(3s)  →  answer(active)  →  feedback(submit/timeout)  →  leaderboard(reveal)  →  next…
```

Screens:
- **Lobby** — big join code, player avatar/name, "Get ready!" pulse.
- **Countdown** — 3-2-1-GO! when a new `current_question_id` appears and `question_started_at` is within the last second; uses scale/opacity animation.
- **Answer** — question prompt at top, `CircularTimer` top-right, 2×2 grid of `AnswerBlock`. Icon-only on mobile, icon + option text on tablet+ (matches Kahoot phone client). Picking locks input and shows a "Waiting for others…" pulse until the host reveals.
- **Feedback** — `FeedbackOverlay` shown the moment the server returns `{ isCorrect, points }`. Streak counter increments on correct, resets on wrong.
- **Leaderboard** — when `session.status === "reveal"`, switch to `PodiumLeaderboard`. Player sees their own row highlighted with delta arrow.
- **Ended** — keep existing navigate to `/results/$sessionId`.

The join page (`src/routes/play.index.tsx`) gets the same playful styling pass (thick borders, bold type, color-blocked CTA) — no logic changes.

## 4. Host screen rewrite — `src/routes/_authenticated/host.$sessionId.tsx`

Keep ALL existing functionality: join code, copy link, Teams share + editable message, copy Teams link, preview as player, start/reveal/next/end controls, players list, answered count. Only the visual presentation changes:

- Lobby panel: oversize join code in Kahoot-style chunky type, color-blocked share buttons, preserved Teams message textarea.
- Active question panel: large prompt card, `CircularTimer`, mini 2×2 preview of the 4 color blocks with live answer-count bars per block (counts from `answers` table — already queried via `answeredCount`, extend to group by `selected_index`).
- Reveal state: highlight the correct color block, dim others, show distribution bars.
- Side panel: replace the plain list with `PodiumLeaderboard` (host view, top 10).

No changes to server functions (`startQuestion`, `revealAnswers`, `endSession`) or RLS.

## 5. Results screen — `src/routes/_authenticated/results.$sessionId.tsx`

- Replace plain list with a final podium (gold/silver/bronze tiles, confetti via simple CSS keyframes) + scrolling top-10. Player highlight for the signed-in user. "Play again" / "Back to dashboard" CTAs in Kahoot colors.

## 6. Profile — `src/routes/_authenticated/profile.tsx`

Visual + new stat tiles. No schema change.
- Avatar in a vibrant rounded card with bold name.
- Three stat tiles computed from existing tables:
  - **Total Points Earned** — sum of `point_events.delta` for this user (or `profiles.points` if already maintained).
  - **Highest Streak** — derived client-side from `answers` filtered by `user_id`, ordered by `created_at`, longest run of `is_correct = true`.
  - **Podium Finishes** — count of sessions where the user finished top 3. Computed via a single server function `getProfileStats` (new, in `src/lib/quiz.functions.ts`, `requireSupabaseAuth`) so we don't ship heavy aggregation to the client.

## 7. Out of scope (explicitly unchanged)

- Database schema, RLS policies, GRANTs.
- Anonymous guest join flow and `joinSessionByCode` logic.
- Admin, platform, banks, challenges, billing, Teams auth.
- Routing structure (no new routes, no renames).

## Technical notes

- All colors go through `@theme` tokens in `src/styles.css`; components reference `bg-kahoot-red`, etc. No hardcoded hex in TSX.
- Animations: Framer Motion for layout transitions (leaderboard reorder, feedback overlay, podium rise); CSS keyframes for the timer ring and 3-2-1 countdown.
- Mobile-first: blocks fill the viewport on small screens; question text collapses behind a "Read question" toggle on phones if too long, matching Kahoot's phone-controller pattern.
- Realtime channels and server-fn contracts stay byte-for-byte the same — only render layer changes.

## File touch list

Edited:
- `src/styles.css` (theme tokens)
- `src/lib/scoring.ts`
- `src/lib/quiz.functions.ts` (add `getProfileStats` only)
- `src/routes/_authenticated/play.$sessionId.tsx`
- `src/routes/_authenticated/host.$sessionId.tsx`
- `src/routes/_authenticated/results.$sessionId.tsx`
- `src/routes/_authenticated/profile.tsx`
- `src/routes/play.index.tsx` (styling pass only)

Created:
- `src/components/quiz/AnswerBlock.tsx`
- `src/components/quiz/CircularTimer.tsx`
- `src/components/quiz/FeedbackOverlay.tsx`
- `src/components/quiz/PodiumLeaderboard.tsx`
- `src/components/quiz/CountdownGo.tsx`

Approve to switch to build mode and implement.
