
# Make QuizPulse a full Microsoft Teams app

You picked the **full Teams suite** (personal tab, channel tab, meeting side panel + stage, message extension, bot), hosted on the **stable Lovable preview URL**, distributed via **Microsoft AppSource**. That's a large body of work — I'll break it into 5 phases you can ship and test incrementally. Each phase ends with something demoable in Teams.

## Heads-up before we start

A few things only you can do — I can't do them from inside Lovable:

1. **Register an Entra ID (Azure AD) app** in the Azure portal. I'll give you the exact redirect URIs, scopes, and manifest fields to paste.
2. **Register a bot** in Bot Framework / Azure Bot Service (needed for the bot + message extension). You'll paste the Bot ID + password back.
3. **Microsoft Partner Center account** for AppSource (one-time, ~€20). Microsoft validation takes 1–4 weeks and requires a published privacy policy + terms of use URL.
4. **Sideload the .zip** into your own tenant for testing before submitting to AppSource.

I'll pause and ask for the IDs/secrets at the right moments via the secrets tool.

---

## Phase 1 — Teams SDK + SSO (foundation)

Everything else depends on this. After Phase 1 the app boots inside a Teams tab and signs the user in silently via their Microsoft 365 identity.

- Install `@microsoft/teams-js`.
- Add a `useTeamsContext()` hook that calls `app.initialize()`, exposes Teams context (tenant ID, team ID, channel ID, meeting ID, theme, locale, user), and falls back to "browser mode" outside Teams so the app still works standalone.
- Add `/auth/teams-start` and `/auth/teams-end` public routes that run the `authentication.authenticate()` popup flow against Entra ID.
- Enable the **Azure (Entra ID) provider** on Lovable Cloud auth alongside the existing Google + email.
- New server fn `exchangeTeamsToken` that takes the Entra ID token from `getAuthToken()`, validates it, and signs the user into Supabase via Azure provider — this is the silent SSO path inside Teams.
- Respect Teams theme (`default` / `dark` / `contrast`) — wire it into the existing dark theme so light/high-contrast users aren't stuck in pure dark.

**You'll need to provide:** Entra ID app `clientId`, `tenantId`, and a client secret (I'll request via the secrets tool when ready).

## Phase 2 — Tenant-scoped orgs

Today every new user gets their own "X's workspace". For Teams, all members of one Microsoft 365 tenant should land in one shared org automatically.

- Migration: add `tenant_id uuid` (Entra tenant ID) to `organizations`, unique. Add `teams_team_id` and `teams_channel_id` columns to `departments` so a Teams channel maps to a department.
- Update `handle_new_user` trigger: if the user signed in via Azure and a matching `tenant_id` org exists, join it instead of creating a new "workspace". First user from a tenant creates the org and becomes `owner`.
- New server fn `linkTeamsChannelToDepartment` so admins can map a Teams channel → department in one click from a channel tab config screen.

## Phase 3 — Tab surfaces (personal + channel + config)

- **Personal tab** at `/teams/personal` — user's dashboard: my quizzes, my points, join a quiz by code, browse banks.
- **Channel/group configurable tab** at `/teams/channel` with a config screen at `/teams/channel/config` — host picks which quiz the tab shows; participants in the channel see the live host/player view embedded.
- **Configurable tab settings page** uses `pages.config.setValidityState(true)` + `setConfig({ contentUrl, suggestedDisplayName })`.
- Wire CSP / iframe so `*.teams.microsoft.com` and `*.teams.cloud.microsoft` can embed the app.

## Phase 4 — Meeting extension (the headline feature)

This is what makes it feel like a Teams-native quiz.

- **In-meeting side panel** at `/teams/meeting/sidepanel` — host controls (start question, reveal, next, end); participants see the play UI scoped to the meeting.
- **Shared meeting stage** at `/teams/meeting/stage` — `meeting.shareAppContentToStage()` pushes the big question + timer + leaderboard to everyone's main meeting view.
- **Pre/post-meeting page** at `/teams/meeting/details` — host picks a quiz before the meeting; results page shown after.
- Meeting context auto-creates a session keyed on `meetingId`, so everyone joining the side panel is auto-added as a player — no join code required inside meetings.
- Manifest declares `meetingExtensionDefinition` with `scenes` for the stage view.

## Phase 5 — Message extension + bot + AppSource packaging

- **Message extension** (search + action commands): share a quiz result card into any chat/channel ("Alice scored 8/10 on Q3 Onboarding — Join the next round"), and an action command to spin up a new quiz session from the compose box.
- **Bot** for proactive notifications: reminders for active challenges, new-quiz announcements to a channel, weekly leaderboard summary. Hosted as a TanStack server route at `/api/public/teams/bot/messages` with HMAC validation of the Bot Framework signing key.
- **Manifest v1.17 + icons**: `manifest.json` with all five surfaces, `color.png` (192×192) and `outline.png` (32×32, monochrome transparent) icons, `validDomains`, `webApplicationInfo` (Entra ID app), `permissions`, `devicePermissions`.
- **AppSource prerequisites**: dedicated `/privacy` and `/terms` public routes, support email, full app description, screenshots, demo video script.
- Build script that zips `manifest.json` + icons into `quizpulse-teams.zip` for sideloading and submission.

---

## Recommended order of operations

```text
Phase 1 (SSO)  →  sideload to your tenant, confirm sign-in works
   ↓
Phase 2 (orgs) →  invite a teammate, confirm you both land in same org
   ↓
Phase 3 (tabs) →  pin personal tab + add channel tab in a test team
   ↓
Phase 4 (meet) →  run a live quiz in a real Teams meeting
   ↓
Phase 5 (ME+bot+package) →  generate .zip, submit to Partner Center
```

Phases 1–4 give you a fully working internal-tenant Teams app. Phase 5 is the extra polish + paperwork for the public AppSource listing.

---

## Technical details (skip if you don't care)

- **Teams JS SDK**: `@microsoft/teams-js` v2.x. `app.initialize()` must run before any other Teams API. Detect Teams via `app.getContext()` — gracefully fall back to standalone web app when it throws.
- **Auth**: Teams' iframe blocks Supabase's Google popup. Replace with `microsoftTeams.authentication.authenticate({ url: '/auth/teams-start' })` for first-time consent and `microsoftTeams.authentication.getAuthToken()` for silent SSO afterwards. Server fn validates the JWT (issuer = `https://login.microsoftonline.com/{tid}/v2.0`, audience = our Entra app's clientId) and exchanges it for a Supabase session via `supabaseAdmin.auth.admin.generateLink({ type: 'magiclink' })` keyed to the Entra `email` claim, or via the new Supabase Azure provider's `signInWithIdToken`.
- **Manifest**: v1.17 schema. `staticTabs` for personal, `configurableTabs` for channel, `meetingExtensionDefinition` with `supportedTabs` + scenes for stage, `composeExtensions` for message extension, `bots` for bot. `validDomains` must include `project--b147aad7-3ae2-4d89-8d21-625495d54b86.lovable.app` (your stable preview URL).
- **Bot**: minimum surface = `/api/public/teams/bot/messages` server route that verifies the `Authorization: Bearer` JWT from Bot Framework against `https://login.botframework.com/v1/.well-known/keys` and replies with Adaptive Cards. State persisted in Supabase, not in-memory (Workers are stateless).
- **CSP**: TanStack Start's default headers need to add `frame-ancestors teams.microsoft.com *.teams.microsoft.com *.skype.com teams.cloud.microsoft *.teams.cloud.microsoft outlook.office.com *.outlook.office.com outlook.office365.com *.outlook.office365.com`.
- **AppSource validation gotchas**: no `localhost` in manifest, every URL must be HTTPS, privacy + terms must load without auth, manifest version must increment on every resubmit, screenshots 1366×768.

---

**Ready to start Phase 1?** It's self-contained (~1 day of work on my side) and gives you something to sideload and demo. Reply "go" and I'll switch to build mode and begin — I'll pause to request the Entra ID secrets when I get to the SSO hook-up.
