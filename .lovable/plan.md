## Fix the 4 standalone quiz app blockers

### 1. Missing `src/lib/error-page.tsx` import
`src/start.ts` imports `./lib/error-page`, and the file exists as `error-page.ts` (not `.tsx`). The import resolves, so this is actually OK — but I'll verify by reading start.ts output. No change needed unless build fails. **Action: verify, no-op if green.**

### 2. Add missing `/play` route (join-by-code entry)
Landing page links to `/play` but no route exists. Create `src/routes/play.tsx` (public, unauthenticated):
- Input for 6-char join code
- On submit: look up session by code via a new `getSessionByCode` server fn
- If user is signed in → redirect to `/play/$sessionId`
- If not → redirect to `/auth?redirect=/play/$sessionId` (or prompt display name for guest play — will default to **require sign-in** for v1 to match existing schema)

### 3. Seed starter quiz packs
Dashboard's "public quizzes" section is empty. Add a migration that inserts 3 starter quizzes (General Knowledge, Tech Trivia, Geography) with ~5 questions each, owned by a system user / marked `is_public = true`. Uses `ON CONFLICT DO NOTHING` so it's idempotent.

### 4. Replace generic root metadata
Update `src/routes/__root.tsx` `head()`:
- title: "Quiz Zone — Live Multiplayer Quizzes"
- description: "Host live quiz sessions with real-time leaderboards. Create quizzes, share a join code, and play together."
- og:title / og:description matching
- twitter:card = summary_large_image

### Files touched
- `src/routes/play.tsx` (new)
- `src/lib/quiz.functions.ts` (add `getSessionByCode`)
- `src/routes/__root.tsx` (metadata)
- New migration: seed starter public quizzes

### Out of scope
Teams integration (next phase, separate plan).
