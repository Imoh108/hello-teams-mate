# Tier enforcement: Basic / Premium / Enterprise

Map every feature already built to one of three tiers, enforce on the server (RLS + server fns), gate in the UI (nav + route guards), and expose tier management to org owners.

## 1. Feature → tier matrix

| Area | Basic | Premium | Enterprise |
|---|---|---|---|
| Quiz engine, /play, casual leaderboards, public packs | ✓ | ✓ | ✓ |
| Profile basics, matchmaking | ✓ | ✓ | ✓ |
| Admin → Question Banks (CMS), Training Documents, Members, Departments | — | ✓ | ✓ |
| AI question generation from documents | — | ✓ | ✓ |
| Analytics dashboard | — | ✓ | ✓ |
| Dataverse `data_backend` switch | — | — | ✓ |
| Shop / Avatar items, Badges, Themed Challenges | — | — | ✓ |
| i18n language switcher | — | — | ✓ (Basic/Premium = English only) |

## 2. Database changes (one migration)

- New enum `subscription_tier` = `basic | premium | enterprise`.
- `organizations.subscription_tier subscription_tier NOT NULL DEFAULT 'basic'`.
- Personal "Casual" play for unaffiliated users keeps working (no org needed).
- Security-definer fn `public.org_tier(_org uuid) returns subscription_tier` (stable, search_path=public).
- Security-definer fn `public.org_has_tier(_org uuid, _min subscription_tier) returns boolean` with ordering basic<premium<enterprise.
- Tighten RLS on premium/enterprise tables to require `org_has_tier(org_id, ...)` in addition to existing membership/admin checks:
  - Premium gate (insert/update): `question_banks`, `bank_questions`, `bank_tags`, `training_documents`.
  - Enterprise gate (insert/update): `avatar_items`, `user_avatar_items`, `badges`, `user_badges`, `challenges`, `challenge_participants`.
  - Reject `organizations.data_backend = 'dataverse'` unless tier = enterprise (CHECK via trigger, since enum compare is immutable-safe but we'll use a BEFORE INSERT/UPDATE trigger for clarity).
- Grants stay as already configured; no new tables.

## 3. Server functions

- `orgs.functions.ts`: add `getOrgTier(orgId)` and `setOrgTier({ orgId, tier })` (owner-only, guarded by `has_org_role owner`).
- In `cms.functions.ts`, `ai.functions.ts`, `analytics.functions.ts`, `gamification.functions.ts`: add a `requireTier(orgId, min)` helper that calls the DB fn and throws `Error('Upgrade required: <min>')` on mismatch. Wire into every write path; reads stay open so existing data remains visible if a tier is downgraded.

## 4. Client gating

- New `useOrgTier()` hook fetching `getOrgTier` per current org, cached.
- `src/lib/tiers.ts`: `TIER_ORDER`, `hasTier(current, min)`, labels.
- `admin.tsx` sidebar: filter nav items by tier; show a "Premium" / "Enterprise" badge next to locked items and route them to an `/admin/upgrade` page instead of the feature when locked.
- Add `beforeLoad` checks on each gated admin route file (`admin.banks*`, `admin.documents`, `admin.analytics`, `admin.badges`, `admin.challenges`, `admin.items`) that read the current org's tier and `throw redirect({ to: '/admin/upgrade' })` when insufficient.
- Hide `/shop`, `/challenges`, `/profile` avatar shop entry, and `LanguageSwitcher` when org tier < enterprise (personal accounts default to Basic → English only, switcher hidden).
- New `/admin/upgrade` route: shows current tier, the matrix above, and (owner-only) tier selector that calls `setOrgTier`. No payment integration — this is the admin toggle the spec implies.
- New `/admin/billing` link in sidebar (always visible to owners) pointing to the upgrade page.

## 5. UX copy / i18n

- Add `tiers.*` keys to `en.json` only (other locales fall back via i18next fallbackLng).
- Lock icons on sidebar items use `lucide-react` `Lock`.

## 6. Out of scope

- No real payment provider wiring (Stripe/Paddle) — toggle is manual by org owner; we can layer Stripe later if requested.
- No data migration for existing orgs beyond defaulting to `basic`; the seeded demo org will be bumped to `enterprise` in the same migration so the smoke-test flows keep working.

## Technical notes
- All tier checks server-side go through `public.org_has_tier` to keep policy SQL short and avoid recursion.
- Client tier checks are advisory — the server is the source of truth.
- `useCurrentOrgId` already exists; tier hook reuses it.
