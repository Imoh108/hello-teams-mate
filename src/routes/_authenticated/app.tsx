import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createQuiz, cloneQuiz, createSession, joinSessionByCode } from "@/lib/quiz.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LanguageSwitcher } from "@/components/language-switcher";
import { toast } from "sonner";
import { Plus, Copy, Play, LogOut, Users, Building2, Trophy, Store, Flame } from "lucide-react";
import { useEnsureCurrentOrg } from "@/hooks/use-ensure-current-org";
import { track } from "@/lib/track";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Dashboard — QuizPulse" }] }),
  component: Dashboard,
});

type Quiz = { id: string; title: string; description: string | null; topic_pack: string; is_public: boolean; owner_id: string | null };
type Session = { id: string; join_code: string; status: string; created_at: string; quiz_id: string };

function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useEnsureCurrentOrg();
  const createFn = useServerFn(createQuiz);
  const cloneFn = useServerFn(cloneQuiz);
  const sessionFn = useServerFn(createSession);
  const joinFn = useServerFn(joinSessionByCode);

  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [publicPacks, setPublicPacks] = useState<Quiz[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [pack, setPack] = useState<"company_trivia" | "industry_knowledge" | "general_culture" | "custom">("custom");
  const [joinCode, setJoinCode] = useState("");

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    const { data: mine } = await supabase.from("quizzes").select("*").eq("owner_id", uid).order("created_at", { ascending: false });
    const { data: pub } = await supabase.from("quizzes").select("*").eq("is_public", true).order("created_at");
    const { data: sess } = await supabase.from("sessions").select("*").eq("host_id", uid).order("created_at", { ascending: false }).limit(10);
    setQuizzes(mine ?? []);
    setPublicPacks(pub ?? []);
    setSessions(sess ?? []);
  };

  useEffect(() => { load(); track("app_open"); }, []);

  const onCreate = async () => {
    if (!title.trim()) return toast.error("Title required");
    try {
      const row = await createFn({ data: { title: title.trim(), description: desc.trim() || undefined, topic_pack: pack } });
      setOpenCreate(false); setTitle(""); setDesc("");
      navigate({ to: "/quizzes/$id", params: { id: (row as any).id } });
    } catch (e: any) { toast.error(e.message); }
  };

  const onClone = async (id: string) => {
    try {
      const row = await cloneFn({ data: { source_quiz_id: id } });
      toast.success("Cloned to your library");
      navigate({ to: "/quizzes/$id", params: { id: (row as any).id } });
    } catch (e: any) { toast.error(e.message); }
  };

  const onLaunch = async (quizId: string) => {
    try {
      const row = await sessionFn({ data: { quiz_id: quizId } });
      navigate({ to: "/host/$sessionId", params: { sessionId: (row as any).id } });
    } catch (e: any) { toast.error(e.message); }
  };

  const onJoin = async () => {
    if (!joinCode.trim()) return;
    try {
      const r = await joinFn({ data: { code: joinCode.trim() } });
      navigate({ to: "/play/$sessionId", params: { sessionId: (r as any).session_id } });
    } catch (e: any) { toast.error(e.message); }
  };

  const onSignOut = async () => { await supabase.auth.signOut(); navigate({ to: "/" }); };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-primary grid place-items-center text-primary-foreground font-display font-bold text-sm">Q</div>
            <span className="font-display font-semibold">QuizPulse</span>
          </Link>
          <div className="flex items-center gap-2">
            <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder={t("nav.joinCode")} className="w-32 font-mono-tab uppercase" maxLength={8} />
            <Button onClick={onJoin} variant="outline" size="sm">{t("nav.join")}</Button>
            <Button asChild variant="ghost" size="sm"><Link to="/profile"><Trophy className="size-4 mr-1" /> {t("nav.profile")}</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/shop"><Store className="size-4 mr-1" /> {t("nav.shop")}</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/challenges"><Flame className="size-4 mr-1" /> {t("nav.challenges")}</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/admin"><Building2 className="size-4 mr-1" /> {t("nav.admin")}</Link></Button>
            <LanguageSwitcher compact />
            <Button onClick={onSignOut} variant="ghost" size="sm"><LogOut className="size-4" /></Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 space-y-10">
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight">{t("dashboard.yourQuizzes")}</h1>
              <p className="text-sm text-muted-foreground">{t("dashboard.yourQuizzesSubtitle")}</p>
            </div>
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> {t("dashboard.newQuiz")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create a quiz</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></div>
                  <div><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} /></div>
                  <div><Label>Topic pack</Label>
                    <Select value={pack} onValueChange={(v) => setPack(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company_trivia">Company trivia</SelectItem>
                        <SelectItem value="industry_knowledge">Industry knowledge</SelectItem>
                        <SelectItem value="general_culture">General culture</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={onCreate}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {quizzes === null ? <p className="text-muted-foreground text-sm">Loading…</p> :
            quizzes.length === 0 ? (
              <div className="glass-panel rounded-xl p-8 text-center text-muted-foreground">
                No quizzes yet. Create one above or clone a starter pack below.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {quizzes.map((q) => (
                  <div key={q.id} className="glass-panel rounded-xl p-5 flex flex-col">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{q.topic_pack.replace("_", " ")}</div>
                    <h3 className="font-display text-lg font-semibold mt-1">{q.title}</h3>
                    {q.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{q.description}</p>}
                    <div className="flex gap-2 mt-4">
                      <Button asChild size="sm" variant="outline" className="flex-1"><Link to="/quizzes/$id" params={{ id: q.id }}>Edit</Link></Button>
                      <Button onClick={() => onLaunch(q.id)} size="sm" className="flex-1"><Play className="size-3 mr-1" /> Launch</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold mb-3">Starter packs</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {publicPacks.map((q) => (
              <div key={q.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{q.topic_pack.replace("_", " ")}</div>
                <h3 className="font-display font-semibold mt-1">{q.title}</h3>
                {q.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{q.description}</p>}
                <Button onClick={() => onClone(q.id)} size="sm" variant="ghost" className="mt-3 w-full"><Copy className="size-3 mr-1" /> Clone</Button>
              </div>
            ))}
          </div>
        </section>

        {sessions.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-semibold mb-3">Recent sessions</h2>
            <div className="rounded-xl border border-border overflow-hidden">
              {sessions.map((s) => (
                <Link key={s.id} to={s.status === "ended" ? "/results/$sessionId" : "/host/$sessionId"} params={{ sessionId: s.id }}
                  className="flex items-center justify-between p-3 border-b border-border last:border-0 hover:bg-surface transition">
                  <div className="flex items-center gap-3">
                    <span className="font-mono-tab text-sm">{s.join_code}</span>
                    <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded bg-surface-2 text-muted-foreground">{s.status}</span>
                  </div>
                  <Users className="size-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
