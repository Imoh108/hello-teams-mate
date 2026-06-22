## Goal

Anyone with a join link can play instantly with just a display name — no account required. Signed-in users still get the richer experience (persistent profile, points, badges, challenges, leaderboards across sessions). The host can also one-click test the join flow as a player without a second account.

## What changes for participants

1. Clicking `https://<app>/play?code=ABC123` opens a **public** join page (no auth gate).
2. The page asks for a display name only (code is prefilled from the URL).
3. They tap **Join as guest** → land in the live player view at `/play/<sessionId>`.
4. A secondary "Sign in for points & badges" link is shown for those who want the full experience; signed-in users skip the name prompt and auto-join (today's behavior).

## What changes for the host

- New **Preview as player** button on the host page (next to Copy code / Share to Teams). Opens `/play?code=<code>&preview=1` in a new tab with a generated guest name like "Host preview" so you can see exactly what teammates see — no second account needed.

## Capability matrix (guest vs registered)

| Capability | Guest | Registered |
|---|---|---|
| Join via link / code | ✅ | ✅ |
| Answer questions, see live results | ✅ | ✅ |
| Session leaderboard | ✅ | ✅ |
| Persistent points / badges / streaks | ❌ | ✅ |
| Cross-session history & profile | ❌ | ✅ |
| Org challenges & rewards | ❌ | ✅ |
| Host a quiz | ❌ | ✅ |

## Technical approach (for reference)

1. **Route move**: split `/play` into a **public** route `src/routes/play.index.tsx` (current file moves out from under `_authenticated/`). The existing `/play/$sessionId` player view also moves to a public route so guests can reach it. The `_authenticated/play.*` files are removed.
2. **Guest identity**: store a `guest_id` (uuid) + `display_name` in `localStorage` on first join. No `auth.users` row.
3. **DB changes** (one migration):
   - `session_players`: make `user_id` nullable, add `guest_id uuid`, add a CHECK that exactly one of `user_id` / `guest_id` is set, unique index on `(session_id, guest_id)`.
   - `answers`: same nullable `user_id` + `guest_id` pair.
   - RLS: add policies so a row with `guest_id = <header-supplied id>` is readable/insertable by the anon role for that specific session. Enforced via a server function that validates the guest id + session code, never raw client writes.
   - GRANTs added per public-table rules.
4. **Server fns**: add `joinSessionAsGuest({ code, display_name, guest_id })` and `submitGuestAnswer(...)` that mirror the authenticated versions but key off `guest_id`. Existing authenticated fns are unchanged.
5. **Scoring/points**: `award_points` is only called when `user_id` is present — guests show on the session leaderboard but don't get profile points.
6. **Host page** (`host.$sessionId.tsx`): add `Preview as player` button → `window.open('/play?code=' + code + '&preview=1', '_blank')`. The join page treats `preview=1` as a hint to prefill display name "Host preview".
7. **Player view**: shows a small "Playing as guest — sign in to save your points" banner when no auth user.

## Out of scope

- Migrating a guest's session score into a real account after sign-up (can be added later).
- Changing email confirmation settings or default sign-in providers.
- Changing host permissions — hosting still requires an account.

## Verification

- Open the join link in an incognito window → name prompt → join → answer questions → appears on host's player list.
- Click **Preview as player** from the host page → join page opens in a new tab and auto-fills.
- Signed-in flow unchanged: clicking a join link while logged in still auto-joins as the registered user.
