Plan to fix the admin dashboard access issue:

1. **Fix the bad 404 URL**
   - Add a safe redirect for any accidental `/_authenticated/...` URL so it automatically strips `/_authenticated` and sends the user to the real route, e.g. `/_authenticated/platform/reports` → `/platform/reports`.
   - Do not edit the generated route tree directly.

2. **Preserve the intended destination through login**
   - Update the protected-route guard so if a user opens `/platform`, `/platform/reports`, or `/admin` while signed out, they are sent to `/auth` with a redirect target.
   - Update the sign-in flow so successful email/password or Google login returns them to the dashboard they originally requested instead of always going to `/app`.

3. **Make master admin access easier to find**
   - Add or confirm a clear entry point from the signed-in app to the master Platform Admin area for users with the platform admin role.
   - Keep normal organization admin at `/admin` and master/platform admin at `/platform`.

4. **Validate the fix**
   - Check that `/platform`, `/platform/reports`, and the old bad `/_authenticated/platform/reports` path no longer produce a 404.
   - Confirm unauthenticated users land on login, and authenticated platform admins can reach the platform dashboard.