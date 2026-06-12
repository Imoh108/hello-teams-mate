import { useEffect, useState } from "react";

const KEY = "qp.currentOrgId";

export function useCurrentOrgId() {
  const [orgId, setOrgIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(KEY);
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (orgId) window.localStorage.setItem(KEY, orgId);
    else window.localStorage.removeItem(KEY);
  }, [orgId]);
  return [orgId, setOrgIdState] as const;
}
