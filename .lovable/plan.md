## Problem
The `/platform` super-admin dashboard is complete (8 phases built), but there is no way to actually reach it or become the first admin on a fresh deployment:

- The route requires the `platform_admin` role, but the `handle_new_user()` trigger only assigns `player`.
- There is no link to `/platform` anywhere in the UI (not in `/app`, `/admin`, or the landing page).
- Typing `/platform` manually redirects non-admins back to `/app`.

## Solution

### 1. Auto-bootstrap the first user as platform admin
Update the `handle_new_user()` database trigger: when a new user signs up, if the `profiles` table is empty (this is the very first user), also insert a `platform_admin` role into `user_roles`.

This guarantees the first account on a fresh app is a super-admin with no manual database editing required.

### 2. Add a conditional "Platform" nav link in `/app`
In the `Dashboard` header (`src/routes/_authenticated/app.tsx`):
- On mount, call `isPlatformAdmin()`.
- If the user is a platform admin, render a new nav link (e.g. a small badge button) that navigates to `/platform`.

This makes the dashboard discoverable without memorizing the URL.

### 3. Optional: add the same link in the org `/admin` sidebar
If the user is already in the org admin area (`/admin`), show a "Platform admin" item in its sidebar or footer for users who also hold the platform role.

## Files to change
- `supabase/migrations/...` — migration to update `handle_new_user()` trigger with first-user bootstrap logic
- `src/routes/_authenticated/app.tsx` — add conditional platform-admin nav link
- `src/routes/_authenticated/admin.tsx` — optional conditional platform-admin link in sidebar

## Technical details
- The trigger is `SECURITY DEFINER` and already has `search_path = public`, so a simple `SELECT count(*) FROM public.profiles` check inside the trigger body is safe.
- `isPlatformAdmin` is an existing `createServerFn` at `src/lib/platform.functions.ts`.
- No new dependencies.

## Acceptance criteria
1. First user to sign up on a fresh database automatically has `platform_admin` role.
2. That user sees a "Platform" link in the `/app` header.
3. Clicking it navigates to `/platform` successfully.
4. Non-admins do not see the link and are redirected away from `/platform` as before.