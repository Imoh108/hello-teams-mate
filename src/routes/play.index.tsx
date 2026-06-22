import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { joinSessionByCode } from "@/lib/quiz.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";

const searchSchema = z.object({
  code: fallback(z.string().optional(), undefined),
  preview: fallback(z.string().optional(), undefined),
  name: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/play/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Join a quiz — QuizPulse" },
      { name: "description", content: "Enter the join code your host shared to jump into a live quiz round. No account required." },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const navigate = useNavigate();
  const joinFn = useServerFn(joinSessionByCode);
  const { code: prefilledCode, preview, name: prefilledName } = Route.useSearch();

  const [code, setCode] = useState((prefilledCode ?? "").toUpperCase());
  const [name, setName] = useState(
    prefilledName ?? (preview ? "Host preview" : "")
  );
  const [loading, setLoading] = useState(false);
  const [authedUserId, setAuthedUserId] = useState<string | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const autoTriedRef = useRef(false);

  // Detect existing session (real user or previous guest)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setAuthedUserId(data.user?.id ?? null);
      setCheckedAuth(true);
    })();
  }, []);

  const doJoin = async (rawCode: string, displayName: string, asGuest: boolean) => {
    const trimmedCode = rawCode.trim().toUpperCase();
    if (trimmedCode.length < 4) {
      toast.error("Enter the full join code");
      return;
    }
    if (asGuest && !displayName.trim()) {
      toast.error("Enter a display name");
      return;
    }
    setLoading(true);
    try {
      if (asGuest) {
        // Anonymous sign-in carries the display name so the profile trigger picks it up
        const { error: signErr } = await supabase.auth.signInAnonymously({
          options: { data: { display_name: displayName.trim() } },
        });
        if (signErr) throw signErr;
        // Keep profile.display_name in sync (anon users may rejoin with a new name)
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          await supabase
            .from("profiles")
            .update({ display_name: displayName.trim() })
            .eq("id", u.user.id);
        }
      }
      const res = (await joinFn({ data: { code: trimmedCode } })) as { session_id: string };
      navigate({ to: "/play/$sessionId", params: { sessionId: res.session_id } });
    } catch (err: any) {
      toast.error(err.message ?? "Could not join");
    } finally {
      setLoading(false);
    }
  };

  // Auto-join existing signed-in users when a code is in the URL
  useEffect(() => {
    if (!checkedAuth || autoTriedRef.current) return;
    const c = (prefilledCode ?? "").trim().toUpperCase();
    if (authedUserId && c.length >= 4) {
      autoTriedRef.current = true;
      void doJoin(c, "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedAuth, authedUserId, prefilledCode]);

  const onGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void doJoin(code, name, true);
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md glass-panel rounded-2xl p-8">
        <div className="text-center">
          <div className="mx-auto size-10 rounded-md bg-primary grid place-items-center text-primary-foreground font-display font-bold">Q</div>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">Join a live quiz</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {authedUserId
              ? "Joining your host's quiz…"
              : preview
              ? "Preview the player experience — no account needed."
              : "Jump in as a guest, or sign in to save points and badges."}
          </p>
        </div>

        {!authedUserId && (
          <form onSubmit={onGuestSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                autoFocus
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sarah K."
                maxLength={40}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="code">Join code</Label>
              <Input
                id="code"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="mt-1 text-center font-mono-tab text-lg tracking-[0.3em] uppercase"
                maxLength={10}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Joining…" : "Join as guest"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Want points, badges, and history?{" "}
              <Link
                to="/auth"
                search={{ redirect: `/play?code=${encodeURIComponent(code || prefilledCode || "")}` }}
                className="text-foreground underline hover:no-underline"
              >
                Sign in instead
              </Link>
            </p>
          </form>
        )}

        {authedUserId && !prefilledCode && (
          <form onSubmit={(e) => { e.preventDefault(); void doJoin(code, "", false); }} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="code-auth">Join code</Label>
              <Input
                id="code-auth"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="mt-1 text-center font-mono-tab text-lg tracking-[0.3em] uppercase"
                maxLength={10}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Joining…" : "Join quiz"}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Back home</Link>
        </div>
      </div>
    </div>
  );
}
