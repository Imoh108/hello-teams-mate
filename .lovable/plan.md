## Phase 2 — Tenant-scoped organizations + Teams ↔ department mapping

Goal: every member of the same Microsoft 365 tenant lands in **one shared org** when they sign in via Teams, and a Teams channel can be linked to a department.

### 1. Schema changes (migration)

**`organizations`**
- Add `tenant_id uuid NULL` (Entra `tid` claim). `UNIQUE` (partial index, where not null).
- Add `tenant_name text NULL` (best-effort display name from token, optional).

**`departments`**
- Add `teams_team_id text NULL`
- Add `teams_channel_id text NULL`
- Add `UNIQUE (teams_channel_id)` (partial, where not null) so one channel maps to at most one department.

**`profiles`**
- Add `entra_oid text NULL` and `entra_tid text NULL` (so we can recognize Teams users on subsequent sign-ins without re-decoding tokens).

### 2. Server-side join logic

The current `handle_new_user` trigger always creates a personal "X's workspace". That's fine for email/Google users but wrong for Teams users — we don't know they're a Teams user at `auth.users` insert time (the magiclink path creates the user before the Entra claims are persisted).

Approach: keep `handle_new_user` as the **fallback** (personal workspace) and add an explicit **`joinOrCreateTenantOrg`** step inside `exchangeTeamsToken` that runs *after* the Supabase user exists. It will:

1. Update `profiles.entra_oid` / `entra_tid` for the user.
2. `SELECT id FROM organizations WHERE tenant_id = :tid`.
3. **If found** → upsert `organization_members (org_id, user_id, org_role='member')`. Also delete the auto-created personal workspace if it has no other members and no content (safe cleanup — `created_by = user_id` AND member_count = 1 AND no quizzes/banks).
4. **If not found** → promote the auto-created personal workspace: `UPDATE organizations SET tenant_id = :tid, name = :tenantName WHERE id = (the user's personal org)`. First Teams user from the tenant keeps `owner` role; the org becomes the tenant org.

This runs in a security-definer SQL function `public.join_or_create_tenant_org(_user uuid, _tid uuid, _tenant_name text, _display text)` called from `teams-auth.functions.ts` via `supabaseAdmin.rpc(...)`. Returns `{ org_id, role, created: bool }`.

### 3. Wire into Teams SSO flow

`src/lib/teams-auth.functions.ts` — after the `verifyOtp` step succeeds (user is signed in), the client doesn't have admin rights, so the **server fn** does it: extend `exchangeTeamsToken` to also call `join_or_create_tenant_org` and return `{ email, tokenHash, orgId }`.

`src/routes/auth.teams-start.tsx` — after `verifyOtp`, set `localStorage.qp.currentOrgId = orgId` so `useCurrentOrgId()` picks the tenant org instead of the personal one on first load.

### 4. Channel ↔ department mapping

New server fn `linkTeamsChannelToDepartment` in `src/lib/orgs.functions.ts`:
- Input: `{ departmentId, teamsTeamId, teamsChannelId }`.
- Auth: `requireSupabaseAuth` + `is_org_admin` check on the department's org.
- Updates the department row. Unique constraint prevents one channel mapping to two departments.

Also `unlinkTeamsChannel({ departmentId })` to clear the mapping.

No UI for this in Phase 2 — the server fn is callable, and Phase 3 (channel tab config screen) will wire a one-click "Map this channel to department X" button into it. Skipping the UI keeps Phase 2 small and verifiable.

### 5. RLS

- `organizations.tenant_id` and `tenant_name`: existing org policies already cover read/update by members/admins — no change needed.
- `departments.teams_*`: existing department policies (org admins write, members read) cover the new columns.
- New unique indexes don't need policy changes.

### 6. Verification steps after build

1. Sign in as Teams user A → lands in `Acme Corp` org (newly promoted from personal workspace), role `owner`.
2. Sign in as Teams user B from same tenant → auto-joins `Acme Corp` as `member`, personal workspace cleaned up.
3. Sign in as user C via Google (non-Teams) → still gets personal workspace, no `tenant_id`.
4. Call `linkTeamsChannelToDepartment` with a fake team/channel ID → row updates; calling again with same channel for a different department fails on unique constraint.

### What's NOT in this phase

- Channel tab config UI (Phase 3).
- Auto-creating departments from Teams channels (Phase 3).
- Reassigning existing single-user orgs to tenant orgs retroactively beyond the cleanup described above (out of scope; current users are test data).

Reply **"go"** to switch to build mode and I'll run the migration + write the server functions.
