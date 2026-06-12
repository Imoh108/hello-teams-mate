
# Plan: Enterprise CMS + Gamification + i18n (Phase 1)

Scope confirmed:
- Feature 1 — Admin CMS (with orgs + departments)
- Feature 5 — Gamification
- Feature 6 — i18n
- Feature 3 — Dataverse: plan the abstraction now, defer the adapter

Out of scope this phase: Feature 2 (Analytics), Feature 4 (AI question gen), Feature 3 Dataverse adapter implementation. The schema and repository layer are designed so they slot in cleanly later.

---

## 1. Multi-tenant foundation (orgs + departments + roles)

New tables (in `public`, RLS on, GRANTs included):

- `organizations` — `id`, `name`, `slug` (unique), `logo_url`, `default_locale`, `created_by`
- `organization_members` — `org_id`, `user_id`, `org_role` enum (`owner` | `admin` | `hr` | `team_lead` | `member`), `department_id`, unique `(org_id, user_id)`
- `departments` — `id`, `org_id`, `name`, `slug`
- Extend existing `quizzes` and `sessions` with optional `org_id` and `department_id` (nullable so existing personal quizzes keep working)

Security:
- New SECURITY DEFINER helpers: `is_org_member(_org, _user)`, `has_org_role(_org, _user, _role)`, `is_org_admin(_org, _user)` (returns true for `owner`/`admin`/`hr`).
- All org-scoped tables: RLS using these helpers. Admin writes (question banks, departments, members) gated by `is_org_admin`. Member reads gated by `is_org_member`.
- Existing `user_roles` (player/manager) stays; new `org_role` is org-scoped and separate.

Onboarding:
- On first sign-in to the new admin area: "Create organization" flow (name → slug → first department). Creator becomes `owner`.
- Invite flow: admin enters email → creates a row in `organization_invites` (`token`, `email`, `org_role`, `department_id`, `expires_at`). Invitee signs in and accepts → row inserted into `organization_members`. (No outbound email this phase; admin copies an invite link.)

UI:
- `/_authenticated/admin/` layout — gated by `is_org_admin` (server fn + client redirect).
- Org switcher in top bar when a user belongs to multiple orgs (stored in localStorage + URL param fallback).

---

## 2. Admin CMS — documents and question banks

New tables:
- `question_banks` — `id`, `org_id`, `name`, `description`, `department_id` (nullable = org-wide), `is_archived`
- `bank_tags` — `id`, `org_id`, `label`, `color` (free-form taxonomy: "Compliance", "Onboarding", etc.)
- `question_bank_tags` — join table
- `bank_questions` — `id`, `bank_id`, `prompt`, `options jsonb` (array of 4), `correct_index`, `time_limit_s`, `explanation`, `source_document_id` (nullable, links back to upload), `created_by`, `is_draft` (default true — supports the future AI-gen review queue)
- `training_documents` — `id`, `org_id`, `uploaded_by`, `filename`, `mime_type`, `byte_size`, `storage_path`, `parsed_text` (nullable), `parse_status` (`pending`/`parsing`/`done`/`failed`), `parse_error`
- Storage: new private bucket `training-documents`, path `{org_id}/{document_id}/{filename}`. RLS: only org admins can read/write that org's prefix.

Server functions (`src/lib/cms/*.functions.ts`):
- `createBank`, `updateBank`, `archiveBank`
- `createBankQuestion`, `updateBankQuestion`, `deleteBankQuestion`, `bulkImportBankQuestions` (CSV/JSON for now)
- `uploadTrainingDocument` (signed-upload URL flow; PDF/DOCX/TXT, 20 MB limit)
- `parseTrainingDocument` — extracts text (PDF.js for PDF, mammoth for DOCX, raw for TXT) and stores in `parsed_text`. Pure-JS libs only (Worker-compatible).
- `listBanks`, `getBank`, `listBankQuestions`

CMS UI routes (all under `/_authenticated/admin/`):
- `/admin` — org dashboard (counts, recent activity)
- `/admin/banks` — list of question banks
- `/admin/banks/$bankId` — editor: questions table + drawer editor (prompt, 4 options, correct, time limit, tags, department)
- `/admin/documents` — upload dropzone + list with parse status
- `/admin/documents/$docId` — preview parsed text + "Use to create bank" button (placeholder for Feature 4)
- `/admin/members` — list members, change `org_role`, assign department, invite new
- `/admin/departments` — CRUD departments
- `/admin/tags` — CRUD tags

Hook into quiz launch: existing "create quiz" flow gains an optional "From question bank" mode that copies N questions from a bank into a quiz (kept as an explicit copy so quizzes stay portable and bank edits don't mutate historical quizzes).

---

## 3. Data-access abstraction (Dataverse-ready, no adapter yet)

Create `src/lib/data/` repository layer that all CMS/gamification server fns call instead of Supabase directly:

```
src/lib/data/
  types.ts                 // domain DTOs (Organization, Bank, BankQuestion, ...)
  repository.ts            // interface OrgRepository, BankRepository, DocumentRepository, ...
  supabase/                // current implementation
    org.repo.ts
    bank.repo.ts
    document.repo.ts
  index.server.ts          // getRepositories() → returns { org, bank, document, ... }
                           // today returns the Supabase impl; later switches per-org based on
                           // organizations.data_backend = 'lovable_cloud' | 'dataverse'
```

Rules:
- Server fns never `import { supabase }` directly for CMS/gamification work — they go through `getRepositories(context)`.
- Every repo method returns plain DTOs (no Supabase types leak through).
- Add `organizations.data_backend` column now (default `lovable_cloud`) so the router has somewhere to dispatch on. No Dataverse adapter is written; only a stub that throws "not implemented" with a clear message, so the seam is real and tested.

This keeps the rest of the app (auth, sessions, players, answers) on direct Supabase calls — only the new enterprise-data surfaces get the abstraction, which is exactly the surface Dataverse would replace.

---

## 4. Gamification

Schema:
- Extend `profiles`: `points` (int, default 0), `equipped_avatar_id` (nullable FK)
- `avatar_items` — `id`, `name`, `category` (`face`/`hat`/`frame`/`background`), `image_url`, `cost_points`, `unlocked_by_badge_id` (nullable), `is_active`
- `user_avatar_items` — `user_id`, `item_id`, `acquired_at`
- `badges` — `id`, `org_id` (nullable = global), `name`, `description`, `icon_url`, `criteria jsonb` (e.g. `{type:'challenge_complete', challenge_id:...}` or `{type:'streak', days:7}`)
- `user_badges` — `user_id`, `badge_id`, `earned_at`, `context jsonb`
- `challenges` — `id`, `org_id`, `name`, `theme_slug` (drives CSS theme), `description`, `starts_at`, `ends_at`, `bank_id` (which question pool), `point_multiplier`, `completion_badge_id`
- `challenge_participants` — `challenge_id`, `user_id`, `joined_at`, `completed_at`, `final_score`

Server fns:
- `awardPoints(userId, delta, reason)` — single funnel called from `submitAnswer` and challenge completion (idempotent via reason+context)
- `purchaseAvatarItem(itemId)` — checks points, debits, inserts ownership
- `equipAvatarItem(itemId)` — checks ownership
- `listActiveChallenges(orgId)`, `joinChallenge`, `completeChallenge`
- `awardBadge(userId, badgeId, context)` — idempotent
- Backfill: hook into existing `submitAnswer` to call `awardPoints` (points = the existing `points` already computed by `computePoints`).

UI:
- `/_authenticated/me` — profile: current avatar, points, badge case, owned items
- `/_authenticated/shop` — avatar item grid with category tabs; "Unlock" button
- `/_authenticated/challenges` — active challenges with themed cards (theme_slug → tailwind class scope)
- Global banner component on `/app` showing the current active challenge (if any)
- Toast on points award and badge unlock (small celebration animation)

Admin CMS extension:
- `/admin/challenges` CRUD
- `/admin/badges` CRUD (org-scoped)
- `/admin/avatar-items` — only platform-wide (managed centrally); per-org custom items deferred

---

## 5. Internationalization (i18n)

Stack:
- `react-i18next` + `i18next` + `i18next-browser-languagedetector`
- Translation files at `src/locales/{en,es,fr,de,pt}.json` for v1 (5 languages; expandable). English is the source of truth.
- `LanguageProvider` initialized in `src/routes/__root.tsx` before `Outlet`.
- Persisted via `profiles.preferred_locale` (server) + `localStorage` (client cache). On sign-in we hydrate from profile.

Coverage:
- All static UI copy (nav, buttons, form labels, toasts, error messages, empty states) moved to translation keys.
- User-generated content (quiz titles, question prompts, bank names) is NOT auto-translated — stays in the language it was authored in.
- Date/number formatting via `Intl` driven by the active locale.
- Language switcher in the top-bar user menu and on the auth page.

SSR safety:
- Use `i18next` initialization that is deterministic per request (no `Date.now()` / `Math.random()` in render). For SSR we default to `en` and rehydrate on client to avoid hydration mismatches — locale switch is a soft client-side re-render until per-route SSR-language detection is added later.

Migration approach (incremental, won't block other work):
- Add infra + 20 highest-traffic strings in the first PR (landing, auth, dashboard, sidebar).
- Subsequent PRs convert one route group at a time. Existing English text remains valid until converted.

---

## 6. Delivery order (suggested)

Phase A — foundation (must land first):
1. Migration: orgs, departments, members, invites, helpers, RLS, GRANTs
2. Data-access abstraction skeleton + Supabase repos for orgs/members/departments
3. Org create + invite flow + `_authenticated/admin/` gate + org switcher

Phase B — CMS (depends on A):
4. Migration: banks, bank_questions, bank_tags, documents + storage bucket
5. Repos + server fns + admin UI for banks, questions, documents, tags
6. "Create quiz from bank" integration into the existing quiz creator

Phase C — gamification (parallel-safe with B):
7. Migration: avatar_items, user_avatar_items, badges, user_badges, challenges, challenge_participants + profile extensions
8. `awardPoints` funnel + hook into `submitAnswer`
9. Shop, profile, challenges UIs + active-challenge banner
10. Admin CRUD for challenges/badges

Phase D — i18n (parallel-safe with anything):
11. i18next setup + 5 locale files seeded from English
12. Convert nav + auth + dashboard + sidebar strings
13. Language switcher + `profiles.preferred_locale`
14. Convert remaining routes opportunistically

---

## 7. Technical details

- All new tables follow the GRANT-then-RLS-then-policy order. No table policy uses `auth.uid()` against another table directly — always via SECURITY DEFINER helpers to avoid recursion (same pattern as the existing `is_session_player` / `is_session_host`).
- Storage bucket `training-documents`: private, signed URLs only, 20 MB cap enforced both client-side and via storage policy.
- Document parsing runs in a server fn using `pdfjs-dist` (legacy build, pure JS) and `mammoth` — both Worker-compatible. Large files parsed asynchronously: upload returns immediately with `parse_status='pending'`, a follow-up server fn does the work and updates the row. (No background workers; the client polls the row until `done`.)
- Repository interface methods accept a `context` arg carrying `{ supabase, userId, orgId }` so the Dataverse adapter can later receive its own `{ dataverseClient, ... }` shape.
- Gamification `awardPoints` writes to a new `point_events` table (`user_id`, `org_id`, `delta`, `reason`, `context jsonb`, `created_at`) — `profiles.points` is a derived sum kept up to date by the server fn. This gives us an audit trail and is needed later for analytics (Feature 2).
- i18n: all `t(...)` calls use stable keys (`auth.signIn.submit`), never the English string as the key, so refactors don't break translations.

---

## 8. What this does NOT include

- Microsoft Dataverse adapter (only the seam)
- Analytics dashboards (Feature 2)
- AI question generation (Feature 4) — the `is_draft` column and document parsing pipeline are ready for it
- Microsoft Teams embed/SSO — separate effort
- Outbound email for invites — invite links copied manually for now
