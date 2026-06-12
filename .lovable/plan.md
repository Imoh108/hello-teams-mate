## End-to-end smoke test plan

I'll drive the preview browser through the full happy path. Because this requires signing in (and the auth form rule says I need your explicit OK to fill credentials), I want to confirm the approach before running it.

### Test flow
1. **Landing** (`/`) — load, verify hero + "Host a quiz" / "Join with code" CTAs render.
2. **Auth** (`/auth`) — sign up a fresh host account (e.g. `host+smoke@quizpulse.test` / random pwd). Verify redirect to `/app`.
3. **Dashboard** (`/app`) — verify it loads, the 3 seeded public packs appear under public quizzes.
4. **Create quiz** — open the dialog, create "Smoke Test Quiz", land on `/quizzes/$id`.
5. **Add 2 questions** with 4 options each and a 15s timer; save.
6. **Launch session** — back on dashboard, hit Play on the quiz, capture the 6-char join code from the host control room (`/host/$sessionId`).
7. **Open a second browser context** as a player: sign up `player+smoke@quizpulse.test`, go to `/play`, enter the code, land on `/play/$sessionId` waiting screen.
8. **Host starts Q1** → verify player sees the question + timer; player picks an answer.
9. **Host reveals** → verify leaderboard updates with the player's score in real time on both host and player views.
10. **Host advances to Q2**, repeat, then **End session** → verify redirect to `/results/$sessionId` with final standings.

### What I'll report
- ✅/❌ per step with screenshots at key checkpoints (dashboard, host control, player live question, leaderboard, results).
- Any console errors, 401s, RLS failures, or broken realtime.
- Any UX bugs noticed along the way (won't fix in this pass — I'll list them for a follow-up).

### Caveats / approvals needed
- **Test accounts**: I'll create two throwaway accounts in your Cloud auth (`host+smoke@…` and `player+smoke@…`). They'll persist unless you ask me to delete them after.
- **Test data**: One quiz + one ended session will remain in the DB. I can clean up afterward via a migration if you want.
- **Two-context play**: The browser tool is single-session. I'll simulate host + player by signing out and back in between steps, OR I can skip the live-realtime cross-tab verification and only confirm the host's view of player joins/scores. **Cross-tab realtime is the riskier path** — let me know if you want me to attempt it (slower, more fragile) or stick to single-session verification.

Approve and I'll run it.