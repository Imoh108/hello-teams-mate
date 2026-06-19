# Testing QuizPulse in Microsoft Teams without sideloading

Your tenant admin has disabled "Upload a custom app." You have two ways to test anyway. Start with Option A.

---

## Option A — Microsoft 365 Agents Playground (no admin, ~5 min)

A local Teams-like host that runs in your browser and loads `teams-package/manifest.json` directly. SSO, channel context, and tab config all work.

### 1. Install the CLI

```bash
npm i -g @microsoft/teamsapp-cli
```

### 2. Allow localhost in the manifest (temporary)

While testing, uncomment the two `localhost` entries in `teams-package/manifest.json` → `validDomains`. **Re-comment them before shipping to production.**

### 3. Launch the Playground

From the repo root:

```bash
teamsapp preview --env local --m365-host teamsapp --manifest-path teams-package/manifest.json
```

A browser window opens with QuizPulse mounted as a Teams tab. Use it to verify:
- The static tab (`/app`) loads and Teams SSO completes
- The channel config screen (`/teams/channel/config`) lists departments and saves a mapping
- Console + network look clean

**Limit:** only one fake user, so you cannot test the multi-user tenant-org join from Phase 2 here.

---

## Option C — Free Microsoft 365 Developer Tenant (~15 min, full real Teams)

Use this when you want to verify the **tenant-org auto-join** with two real users.

1. Sign up at <https://developer.microsoft.com/microsoft-365/dev-program> and create an "Instant sandbox." You become the admin.
2. Sign into <https://teams.microsoft.com> with the sandbox admin account.
3. Upload `quizpulse-teams.zip` via **Apps → Manage your apps → Upload an app → Upload a custom app**.
4. Test the multi-user flow: sign in as the admin (becomes org owner), then invite a second sandbox user from Microsoft 365 admin center and have them sign into Teams + open QuizPulse. They should land in the same org as a `member`, and their auto-created personal workspace should be cleaned up.

---

## Why not Option B (Developer Portal)?

Developer Portal for Teams is usually gated by the same policy as sideloading. If "Upload a custom app" is off, Developer Portal upload almost always is too. Skip unless your admin explicitly told you otherwise.
