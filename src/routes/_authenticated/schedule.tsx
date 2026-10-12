import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createSession } from "@/lib/quiz.functions";
import { useEnsureCurrentOrg } from "@/hooks/use-ensure-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { title: "Scheduled Quizzes — QuizPulse" },
      { name: "description", content: "Plan upcoming quiz sessions for your workspace." },
      { property: "og:title", content: "Scheduled Quizzes — QuizPulse" },
      { property: "og:description", content: "Schedule team quizzes and join when they go live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Schedule,
});

type Sched = { id: string; title: string; quiz_id: string; scheduled_at: string; created_by: string; session_id: string | null };

function Schedule() {
  const orgId = useEnsureCurrentOrg();
  const navigate = useNavigate();
  const sessionFn = useServerFn(createSession);
  const [me, setMe] = useState<string | null>(null);
  const [items, setItems] = useState<Sched[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [quizzes, setQuizzes] = useState<{ id: string; title: string }[]>([]);
  const [quizId, setQuizId] = useState("");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    setMe(u.user?.id ?? null);
    if (u.user) {
      const { data: q } = await supabase.from("quizzes").select("id,title").eq("owner_id", u.user.id).order("created_at", { ascending: false });
      setQuizzes(q ?? []);
    }
    if (!orgId) return;
    const since = new Date(Date.now() - 6 * 3600e3).toISOString();
    const { data } = await supabase.from("scheduled_quizzes").select("*").eq("org_id", orgId).gte("scheduled_at", since).order("scheduled_at");
    setItems((data ?? []) as Sched[]);
    const ids = (data ?? []).map((d: any) => d.session_id).filter(Boolean);
    if (ids.length) {
      const { data: s } = await supabase.from("sessions").select("id,join_code").in("id", ids);
      setCodes(Object.fromEntries((s ?? []).map((x: any) => [x.id, x.join_code])));
    }
  };
  useEffect(() => { load(); }, [orgId]);

  const add = async () => {
    if (!orgId || !me) return toast.error("No workspace selected");
    if (!quizId || !when) return toast.error("Pick a quiz and a time");
    const at = new Date(when);
    if (at.getTime() < Date.now()) return toast.error("Pick a time in the future");
    const quiz = quizzes.find((q) => q.id === quizId);
    const { error } = await supabase.from("scheduled_quizzes").insert({
      org_id: orgId, quiz_id: quizId, title: title.trim() || quiz?.title || "Quiz", scheduled_at: at.toISOString(), created_by: me,
    });
    if (error) return toast.error(error.message);
    toast.success("Quiz scheduled"); setTitle(""); setWhen(""); load();
  };

  const start = async (s: Sched) => {
    try {
      const row: any = await sessionFn({ data: { quiz_id: s.quiz_id } });
      await supabase.from("scheduled_quizzes").update({ session_id: row.id }).eq("id", s.id);
      navigate({ to: "/host/$sessionId", params: { sessionId: row.id } });
    } catch (e: any) { toast.error(e.message); }
  };

  const remove = async (id: string) => {
    await supabase.from("scheduled_quizzes").delete().eq("id", id); load();
  };

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-8 text-foreground">
      <Link to="/app" className="text-sm text-muted-foreground hover:text-foreground">← Dashboard</Link>
      <h1 className="font-display text-3xl font-black mt-3 flex items-center gap-2"><CalendarClock className="size-7" /> Scheduled quizzes</h1>

      <div className="mt-6 kahoot-radius bg-card border-2 border-border p-4 space-y-3">
        <div className="font-display font-bold">Schedule a quiz</div>
        <div><Label>Quiz</Label>
          <Select value={quizId} onValueChange={setQuizId}>
            <SelectTrigger><SelectValue placeholder={quizzes.length ? "Choose one of your quizzes" : "Create a quiz first"} /></SelectTrigger>
            <SelectContent>{quizzes.map((q) => <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Title (optional)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Friday team quiz" /></div>
        <div><Label>Date & time</Label><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
        <Button onClick={add}>Schedule</Button>
      </div>

      <h2 className="font-display text-xl font-black mt-8">Upcoming</h2>
      {items.length === 0 && <p className="text-muted-foreground mt-2">Nothing scheduled yet.</p>}
      <ul className="mt-3 space-y-2">
        {items.map((s) => {
          const at = new Date(s.scheduled_at);
          const mine = s.created_by === me;
          const code = s.session_id ? codes[s.session_id] : null;
          return (
            <li key={s.id} className="kahoot-radius bg-card border-2 border-border p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{s.title}</div>
                <div className="text-sm text-muted-foreground">{at.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              {code ? (
                mine ? <Button asChild size="sm"><Link to="/host/$sessionId" params={{ sessionId: s.session_id! }}>Open host</Link></Button>
                     : <Button asChild size="sm"><Link to="/play" search={{ code } as any}>Join {code}</Link></Button>
              ) : mine ? <Button size="sm" onClick={() => start(s)}>Start now</Button>
                : <span className="text-xs text-muted-foreground">Not started</span>}
              {mine && <Button size="icon" variant="ghost" aria-label="Delete schedule" onClick={() => remove(s.id)}><Trash2 className="size-4" /></Button>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
