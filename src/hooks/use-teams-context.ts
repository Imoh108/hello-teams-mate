import { useEffect, useState } from "react";
import type { app } from "@microsoft/teams-js";

export type TeamsTheme = "default" | "dark" | "contrast";

export type TeamsContextState = {
  /** True only when the page is actually loaded inside Microsoft Teams (or Outlook/M365 host). */
  inTeams: boolean;
  /** True until the SDK has either initialized or definitively failed. */
  loading: boolean;
  /** Teams app context if running inside Teams. */
  context: app.Context | null;
  /** Current Teams theme (default/dark/contrast). Mirrored onto <html data-teams-theme>. */
  theme: TeamsTheme;
  /** SDK init error message, if any. */
  error: string | null;
};

const INITIAL: TeamsContextState = {
  inTeams: false,
  loading: true,
  context: null,
  theme: "dark",
  error: null,
};

/**
 * Initializes the Microsoft Teams SDK exactly once per page load and returns
 * the active context. Outside Teams (regular browser tab) it resolves quickly
 * with `inTeams: false` so the standalone app continues to work unchanged.
 */
export function useTeamsContext(): TeamsContextState {
  const [state, setState] = useState<TeamsContextState>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    let unregisterTheme: (() => void) | undefined;

    (async () => {
      try {
        const teams = await import("@microsoft/teams-js");
        // initialize() resolves only when running inside a Teams host.
        // We race it against a short timeout so standalone browser users
        // aren't blocked forever.
        const initPromise = teams.app.initialize();
        const timeout = new Promise<"timeout">((resolve) =>
          setTimeout(() => resolve("timeout"), 1500),
        );
        const winner = await Promise.race([initPromise.then(() => "ok" as const), timeout]);

        if (cancelled) return;
        if (winner === "timeout") {
          setState({ ...INITIAL, loading: false });
          return;
        }

        const ctx = await teams.app.getContext();
        if (cancelled) return;

        const theme = (ctx.app.theme as TeamsTheme) ?? "dark";
        applyTheme(theme);
        setState({ inTeams: true, loading: false, context: ctx, theme, error: null });

        teams.app.registerOnThemeChangeHandler((nextTheme) => {
          const t = (nextTheme as TeamsTheme) ?? "dark";
          applyTheme(t);
          setState((prev) => ({ ...prev, theme: t }));
        });
        unregisterTheme = () => {
          // Teams SDK has no unregister; noop. Kept for symmetry.
        };
      } catch (err) {
        if (cancelled) return;
        setState({
          ...INITIAL,
          loading: false,
          error: err instanceof Error ? err.message : "Teams SDK init failed",
        });
      }
    })();

    return () => {
      cancelled = true;
      unregisterTheme?.();
    };
  }, []);

  return state;
}

function applyTheme(theme: TeamsTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.teamsTheme = theme;
}
