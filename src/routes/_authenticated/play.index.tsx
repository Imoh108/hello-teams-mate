import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { joinSessionByCode } from "@/lib/quiz.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/play/")({
  head: () => ({
    meta: [
      { title: "Join a quiz — QuizPulse" },
      { name: "description", content: "Enter the join code your host shared to jump into a live quiz round." },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const navigate = useNavigate();
  const joinFn = useServerFn(joinSessionByCode);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length < 4) return toast.error("Enter the full join code");
    setLoading(true);
    try {
      const res = (await joinFn({ data: { code: trimmed } })) as { session_id: string };
      navigate({ to: "/play/$sessionId", params: { sessionId: res.session_id } });
    } catch (err: any) {
      toast.error(err.message ?? "Could not join");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md glass-panel rounded-2xl p-8">
        <div className="text-center">
          <div className="mx-auto size-10 rounded-md bg-primary grid place-items-center text-primary-foreground font-display font-bold">Q</div>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">Join a live quiz</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ask your host for the join code.</p>
        </div>
        <form onSubmit={onJoin} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="code">Join code</Label>
            <Input
              id="code"
              autoFocus
              autoComplete="off"
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
        <div className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/app" className="hover:text-foreground">Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
}
