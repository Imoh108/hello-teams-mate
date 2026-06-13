import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/auth/teams-end")({
  head: () => ({ meta: [{ title: "Finishing sign-in… — QuizPulse" }] }),
  component: TeamsAuthEnd,
});

/**
 * OAuth redirect target reached after Entra ID returns. Reads the token /
 * error from the URL fragment and forwards it to the opener via the Teams
 * SDK so the popup can close itself.
 */
function TeamsAuthEnd() {
  useEffect(() => {
    (async () => {
      try {
        const teams = await import("@microsoft/teams-js");
        await teams.app.initialize();
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const error = hash.get("error");
        if (error) {
          teams.authentication.notifyFailure(error);
          return;
        }
        const accessToken = hash.get("access_token");
        const idToken = hash.get("id_token");
        if (accessToken || idToken) {
          teams.authentication.notifySuccess(
            JSON.stringify({ accessToken, idToken }),
          );
        } else {
          teams.authentication.notifyFailure("missing_token");
        }
      } catch {
        // Closed manually or not in Teams; nothing to notify.
      }
    })();
  }, []);

  return (
    <div className="min-h-screen grid place-items-center px-6 bg-background text-foreground">
      <p className="text-sm text-muted-foreground">Finishing sign-in…</p>
    </div>
  );
}
