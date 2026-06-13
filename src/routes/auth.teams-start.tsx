import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/auth/teams-start")({
  head: () => ({ meta: [{ title: "Signing in… — QuizPulse" }] }),
  component: TeamsAuthStart,
});

/**
 * Popup page launched by `microsoftTeams.authentication.authenticate()`.
 * Phase 1 stub: this route exists so the Teams SDK can open a popup; the
 * actual Entra ID redirect is wired in Phase 1b once the Entra app
 * credentials are configured. For now it just notifies the parent so the
 * standalone app keeps working.
 */
function TeamsAuthStart() {
  const [msg, setMsg] = useState("Preparing Microsoft sign-in…");

  useEffect(() => {
    (async () => {
      try {
        const teams = await import("@microsoft/teams-js");
        await teams.app.initialize();
        setMsg(
          "Microsoft sign-in is not yet configured. The administrator must register an Entra ID app and add the client ID to project secrets.",
        );
        // Close cleanly so the calling tab gets a recognisable failure.
        teams.authentication.notifyFailure("entra_not_configured");
      } catch {
        setMsg("This page must be opened from inside Microsoft Teams.");
      }
    })();
  }, []);

  return (
    <div className="min-h-screen grid place-items-center px-6 bg-background text-foreground">
      <div className="glass-panel rounded-2xl p-8 max-w-md text-center">
        <div className="mx-auto size-10 rounded-md bg-primary grid place-items-center text-primary-foreground font-display font-bold">
          Q
        </div>
        <h1 className="mt-4 font-display text-xl font-semibold">Microsoft sign-in</h1>
        <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
      </div>
    </div>
  );
}
