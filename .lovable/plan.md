
# Unlock everything now, fix org selection, harden host/play

Goal: make every feature visible and usable today. Keep the tier scaffolding in place so we can flip the paywall on at launch without re-plumbing.

## 1. Open all features (temporary "pre-launch" mode)

Single migration:
- `UPDATE public.organizations SET subscription_tier = 'enterprise';` — bump every existing org.
- Change the `organizations.subscription_tier` column default from `'basic'` to `'enterprise'` so new orgs unlock everything by default.

Code:
- Add `PRELAUNCH_UNLOCK_ALL = true` flag in `src/lib/tiers.ts`.
- `hasTier()` returns `true` when the flag is on (client-side gates open).
- `requireTier()` in `src/lib/tier-guard.server.ts` becomes a no-op when the flag is on (server-side gates open).
- `TierGate` renders children unconditionally when the flag is on.
- Result: Shop, Challenges, Badges, Items, Analytics, Banks, Documents, AI generation, i18n switcher — all visible to every signed-in user.
- At launch we flip the flag to `false`, and the existing per-tier RLS + server checks immediately enforce the paywall again.

`/admin/upgrade` stays in place (owner can still pick a tier) but shows a "Pre-launch: all features unlocked" banner so we don't forget.

## 2. Fix "no organization / can't select one"

Two parts:

**a. Auto-create a personal org on first sign-in.** Extend the `handle_new_user()` trigger so that when a profile is created we also:
- Insert a row into `public.organizations` named `"{display_name}'s workspace"`, `subscription_tier = 'enterprise'`, `data_backend = 'lovable_cloud'`.
- Insert the user into `public.organization_members` with `org_role = 'owner'`.

This guarantees every account has at least one org and is the owner.

**b. Auto-select an org on the client.** New `useEnsureCurrentOrg` hook used by `_authenticated/route.tsx` (or `app.tsx`):
- If `qp.currentOrgId` in localStorage is missing OR points to an org the user is no longer a member of, call a new server fn `getMyOrgs()` and set the first one.
- Add a visible org switcher in the top bar (already partially wired in admin sidebar — surface it in the main app header too) so the user can change orgs.

After this, `/shop` and friends stop showing "Select an organization first."

## 3. Harden the host/play flow

From the smoke test, the host→play loop works end-to-end (lobby, join code, score writes), but two friction points keep tripping users:

1. **No "advance question" affordance on the host screen after launch** — the lobby shows "Start first question" but the per-question controls weren't being verified end-to-end. Audit `src/routes/_authenticated/host.$sessionId.tsx`:
   - Ensure `Start first question` → reveals current question + timer + "Reveal answers" + "Next question" buttons.
   - Ensure final question → "End session" → navigates host to `/results/$sessionId`.
2. **Player side timing** — confirm `play.$sessionId.tsx` polls/realtime-subscribes to `sessions.current_question_index` and auto-advances. If not, switch to a Supabase realtime channel on the `sessions` row.
3. **Leaderboard refresh** — after each `award_points`, invalidate the leaderboard query on both host and player screens.

No schema changes needed for this part — only client wiring.

## 4. Quiet wins (done in passing)

- Suppress the hydration warning on `/auth` caused by the Norton/LastPass-style password-manager extension by adding `suppressHydrationWarning` to the email/password inputs.
- Add a small "Pre-launch mode — all features unlocked" pill to the admin sidebar so it's obvious why no upgrade prompts appear.

## Technical details

**Migration (single file):**
```sql
ALTER TABLE public.organizations
  ALTER COLUMN subscription_tier SET DEFAULT 'enterprise';
UPDATE public.organizations SET subscription_tier = 'enterprise';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_org_id uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url) VALUES (...);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'player');

  INSERT INTO public.organizations (name, subscription_tier, data_backend, created_by)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'display_name','My') || '''s workspace',
          'enterprise', 'lovable_cloud', NEW.id)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (org_id, user_id, org_role)
  VALUES (new_org_id, NEW.id, 'owner');
  RETURN NEW;
END $$;
```
(Trigger is already attached to `auth.users`; only the function body changes.)

**Files touched:**
- new migration
- `src/lib/tiers.ts` (add flag, short-circuit `hasTier`)
- `src/lib/tier-guard.server.ts` (short-circuit `requireTier`)
- `src/components/tier-gate.tsx` (respect flag)
- `src/hooks/use-ensure-current-org.ts` (new)
- `src/lib/orgs.functions.ts` (`getMyOrgs` if not already exported)
- `src/routes/_authenticated/route.tsx` or `app.tsx` (call the hook)
- `src/routes/_authenticated/admin.tsx` + main app header (org switcher already partly there — surface it)
- `src/routes/_authenticated/host.$sessionId.tsx` + `play.$sessionId.tsx` (verify advance/realtime/leaderboard)
- `src/routes/auth.tsx` (suppressHydrationWarning on inputs)

## Out of scope (for launch later)

- Stripe/Paddle billing wiring — when ready, flip `PRELAUNCH_UNLOCK_ALL = false` and add a checkout flow to `/admin/upgrade`.
- Multi-org invites UI polish.
