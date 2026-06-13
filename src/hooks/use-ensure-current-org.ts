import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyOrganizations } from "@/lib/orgs.functions";
import { useCurrentOrgId } from "./use-current-org";

/**
 * Ensures the user has an org selected in localStorage. If none is set, or the
 * stored id is no longer one the user belongs to, picks the first org from
 * the server. New users get a personal workspace auto-created by the
 * handle_new_user() trigger, so this should always find one.
 */
export function useEnsureCurrentOrg() {
  const [orgId, setOrgId] = useCurrentOrgId();
  const listFn = useServerFn(listMyOrganizations);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const orgs = (await listFn({})) as Array<{ id: string }>;
        if (cancelled) return;
        if (!orgs || orgs.length === 0) return;
        const valid = orgs.some((o) => o.id === orgId);
        if (!orgId || !valid) setOrgId(orgs[0].id);
      } catch {
        /* no-op */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return orgId;
}
