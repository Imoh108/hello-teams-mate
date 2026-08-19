import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, Shield, Zap, Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuizPulse — Live Team Quizzes for Microsoft Teams" },
      { name: "description", content: "Moderated, real-time trivia for the workplace. Strict anti-cheating, live leaderboards, manager controls — ready to embed in Microsoft Teams." },
      { property: "og:title", content: "QuizPulse — Live Team Quizzes" },
      { property: "og:description", content: "Moderated real-time trivia with strict anti-cheating and live leaderboards." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-md bg-primary grid place-items-center text-primary-foreground font-display font-bold">Q</div>
          <span className="font-display text-lg font-semibold tracking-tight">QuizPulse</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link to="/auth" search={{ redirect: undefined }} className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
          <Button asChild size="sm"><Link to="/auth" search={{ redirect: undefined }}>Get started</Link></Button>
        </nav>
      </header>

      <main className="container mx-auto px-6">
        <section className="mx-auto max-w-3xl py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <span className="live-dot" /> Built for Microsoft Teams workflows
          </div>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight sm:text-6xl">
            Run moderated team quizzes <span className="text-primary">in real time.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            QuizPulse turns any channel into a live trivia round. Managers host, colleagues compete,
            scores update instantly — with anti-cheating built in.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg" className="font-semibold"><Link to="/auth" search={{ redirect: undefined }}>Host a quiz</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/play">Join with code</Link></Button>
          </div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="glass-panel rounded-xl p-5">
              <f.icon className="size-5 text-primary" />
              <h3 className="mt-3 font-display text-base font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="glass-panel mb-20 rounded-2xl p-8 sm:p-12">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight">A control room for the host.</h2>
              <p className="mt-3 text-muted-foreground">
                Start rounds, skip questions, adjust the timer mid-game, and pause for discussion.
                Players get the question at the exact same moment — no early peek.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {["Server-anchored countdowns", "Auto-flag on tab switch", "Per-player option shuffle", "One-attempt lock"].map((x) => (
                  <li key={x} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-primary" /> {x}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-surface-2 p-6 font-mono-tab text-sm">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>SESSION · KH4P29</span>
                <span className="flex items-center gap-1"><span className="live-dot" /> LIVE</span>
              </div>
              <div className="mt-4 text-2xl text-foreground">Q3 / 6 · 00:12</div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                {["Sarah · 2,340", "Marcus · 2,120", "Priya · 1,980", "Tom · 1,610"].map((p) => (
                  <div key={p} className="rounded-md bg-background/50 px-3 py-2">{p}</div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="container mx-auto px-6 py-6 text-xs text-muted-foreground">© QuizPulse</div>
      </footer>
    </div>
  );
}

const features = [
  { icon: Zap, title: "Live everything", desc: "Realtime question reveal, timer, and leaderboard for every player at once." },
  { icon: Shield, title: "Anti-cheating", desc: "Tab-switch detection, shuffled options, one-attempt lock per question." },
  { icon: Sparkles, title: "Manager moderation", desc: "Start, skip, pause, retime. Host sees who's answered, not what." },
  { icon: Trophy, title: "Post-game insights", desc: "Per-player scores, accuracy, and topic-level strengths." },
];
