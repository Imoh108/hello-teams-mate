import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { acceptInvite } from "@/lib/orgs.functions";
import { useCurrentOrgId } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/invite/$token")({
  head: () => ({ meta: [{ title: "Accept invitation — QuizPulse" }] }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = useParams({ from: "/_authenticated/invite/$token" });
  const navigate = useNavigate();
  const acceptFn = useServerFn(acceptInvite);
  const [, setOrgId] = useCurrentOrgId();
  const [state, setState] = useState<"idle" | "accepting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState("accepting");
      try {
        const r = (await acceptFn({ data: { token } })) as { orgId: string };
        if (cancelled) return;
        setOrgId(r.orgId);
        toast.success("Joined organization");
        setState("done");
        navigate({ to: "/admin" });
      } catch (e: any) {
        if (cancelled) return;
        setError(e.message);
        setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [token, acceptFn, navigate, setOrgId]);

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="glass-panel rounded-xl p-6 max-w-md w-full text-center">
        {state === "accepting" && <p>Accepting invitation…</p>}
        {state === "done" && <p>You're in! Redirecting…</p>}
        {state === "error" && (
          <>
            <h2 className="font-display text-lg font-bold">Invitation problem</h2>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
            <Button className="mt-4" onClick={() => navigate({ to: "/app" })}>Back to dashboard</Button>
          </>
        )}
      </div>
    </div>
  );
}
