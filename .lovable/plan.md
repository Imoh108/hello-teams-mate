## You can't sideload — here are 3 working alternatives

Sideloading ("Upload a custom app") is often disabled by your Microsoft 365 tenant admin. You don't need it to test QuizPulse. Pick one of these:

---

### Option A — Microsoft 365 Agents Playground (fastest, no admin needed)

A local Teams-like host that runs in your browser and loads your manifest directly. No tenant permission required.

Steps I'll guide you through:
1. Install the Teams Toolkit CLI: `npm i -g @microsoft/teamsapp-cli`
2. Point it at `teams-package/manifest.json`
3. Run `teamsapp preview --env local` — it opens a browser window that mounts your tab exactly like Teams would, including `teams-js` SDK calls (SSO, channel context, config save).

Best for: verifying the channel config screen, SSO redemption, and the static tab UI without involving your tenant at all.

---

### Option B — Developer Portal for Teams (web, needs sideload permission too — skip if A failed for the same reason)

Only useful if "upload custom app" is blocked but "Developer Portal" is allowed. Usually both are gated together, so try A first.

---

### Option C — Free Microsoft 365 Developer Tenant (full real Teams, ~15 min)

Sign up at `developer.microsoft.com/microsoft-365/dev-program` → get a free sandbox tenant where **you are the admin**, so sideloading is on by default. Then upload `quizpulse-teams.zip` normally.

Best for: full end-to-end test including the tenant-org auto-join logic from Phase 2 (you can invite a second sandbox user to verify two users land in the same org).

---

### What I'd do (recommendation)

Start with **Option A** today — it tests 90% of the surface in 5 minutes with zero admin friction. Use **Option C** later when you want to validate the multi-user tenant-join flow, which Option A can't simulate (only one fake user).

---

### What I will do if you approve

1. Add a short `TESTING.md` at the repo root with the exact commands for Option A and the signup link for Option C, including the manifest path and the localhost URL you need to whitelist in `validDomains` temporarily for the Playground.
2. Add `localhost` and `127.0.0.1` entries (commented out by default) to `teams-package/manifest.json`'s `validDomains` so you can flip them on for local testing without breaking the production manifest.

No app code changes — this is docs + manifest only.

Reply **go** to apply, or tell me which option you want and I'll tailor the docs to just that one.
