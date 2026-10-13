import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowLeft, Play, Users, Swords, Zap, CalendarClock, Trophy } from "lucide-react";

export const Route = createFileRoute("/how-to-play")({
  head: () => ({ meta: [
    { title: "How to use & play — QuizPulse" },
    { name: "description", content: "A simple guide to joining and hosting QuizPulse, live quizzes, team games, duels, power-ups and daily challenges." },
    { property: "og:title", content: "How to use & play — QuizPulse" },
    { property: "og:description", content: "Learn how to join, host and play each QuizPulse game mode." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: HowToPlay,
});

function Steps({ items }: { items: string[] }) {
  return <ol className="mt-4 space-y-3 list-decimal pl-5 text-sm leading-relaxed text-muted-foreground">{items.map(item => <li key={item} className="pl-1">{item}</li>)}</ol>;
}

function HowToPlay() {
  return (
    <div className="min-h-screen text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="size-4" /> QuizPulse</Link></Button>
          <Button asChild size="sm"><Link to="/play"><Play className="size-4" /> Join a quiz</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
        <BookOpen className="size-7 text-primary mb-3" />
        <h1 className="font-display text-3xl sm:text-4xl font-bold">How to use & play</h1>
        <p className="mt-3 text-muted-foreground">New to QuizPulse? Start here, then choose your game below.</p>

        <section className="mt-8 grid sm:grid-cols-2 gap-8 border-b border-border pb-8" aria-label="Getting started">
          <div>
            <h2 className="font-display text-xl font-semibold">I want to play</h2>
            <Steps items={[
              "Open the link your host shared, scan their QR code, or choose Join with code on the home page.",
              "Enter the join code if it is not filled in. Guests enter a display name and choose Join as guest. Signed-in players choose Join quiz, or join automatically from a shared link.",
              "Wait in the lobby. Your host starts the game when everyone is ready.",
              "Read each question and tap one answer before your timer runs out. Your first answer is final.",
              "Watch the feedback and scores, then wait for the host to move to the next question.",
            ]} />
            <p className="mt-4 text-sm text-muted-foreground">You can join a live quiz as a guest. Sign in for your profile, badges and saved activity.</p>
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">I want to host</h2>
            <Steps items={[
              "Sign in and open your dashboard. Choose a Quick play template, clone a Starter pack, or select New quiz.",
              "For New quiz, enter a title, select categories, rounds, questions per round, difficulty and time per question. Choose Build quiz, then review your questions.",
              "Choose Launch on your quiz. Select Solo or a team option in the lobby.",
              "Share the join link, QR code or join code. You can also share through Teams. Use the public app link, not a private preview link.",
              "Wait for players to appear, then start the game. Reveal questions and move through the results using the host controls.",
              "Finish the quiz to see the final scores. Recent sessions on your dashboard let you return to results.",
            ]} />
          </div>
        </section>

        <section className="mt-8" aria-labelledby="game-modes">
          <h2 id="game-modes" className="font-display text-2xl font-bold">Games & how to play</h2>
          <p className="mt-2 text-sm text-muted-foreground">Open a game below for its instructions.</p>
          <div className="mt-4 divide-y divide-border border-y border-border">
            {games.map(({ title, icon: Icon, steps, note }) => (
              <details key={title} className="group py-4">
                <summary className="cursor-pointer font-display font-semibold flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring">
                  <Icon className="size-5 shrink-0 text-primary" />
                  <span className="flex-1">{title}</span><span aria-hidden="true" className="text-muted-foreground group-open:rotate-45 transition-transform text-xl">+</span>
                </summary>
                <div className="sm:pl-8"><Steps items={steps} />{note && <p className="mt-4 text-sm text-foreground">{note}</p>}</div>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-8 border-b border-border pb-8">
          <h2 className="font-display text-xl font-semibold">Your profile & settings</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Open Profile to see points, earned badges and activity. Buy avatar items in Shop, then equip them in your Profile. The Theme button changes the appearance on your device; Language changes available translated labels.</p>
        </section>
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">Having trouble?</h2>
          <ul className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground list-disc pl-5">
            <li>Cannot join? Check the full code with your host and ask whether the session is still open.</li>
            <li>A link asks you to register with Lovable? Ask your host for the published QuizPulse join link instead.</li>
            <li>Keep the quiz tab open while playing. Switching tabs can be flagged by the host.</li>
            <li>No sound? Check your device volume and the game's sound control. Your browser may need a tap before playing audio.</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild><Link to="/play">Join a quiz</Link></Button>
            <Button asChild variant="outline"><Link to="/app">Open dashboard</Link></Button>
          </div>
        </section>
      </main>
    </div>
  );
}

const games = [
  { title: "Live quiz · Solo", icon: Play, steps: ["Join your host's session and wait for the start.", "Choose the correct answer from the coloured answer blocks. Read the answer text rather than copying another player's colour: options can be shuffled.", "Correct answers earn points; faster correct answers earn more. Wrong or missed answers earn no points.", "Keep answering until the host ends the quiz. The highest total score wins."], note: "One answer per question — you cannot change it after submitting." },
  { title: "Team quiz", icon: Users, steps: ["The host chooses 2, 3 or 4 teams before the game starts.", "Players are automatically assigned to teams. Check your team badge in the lobby.", "Each player answers on their own device, just like a solo live quiz.", "Team scores use the average of members' scores, not their combined total. Help your team by answering accurately and quickly."], note: "The team leaderboard appears alongside individual results." },
  { title: "Power-ups · Live quizzes", icon: Zap, steps: ["Use a power-up while a question is active, before you submit your answer.", "50/50 hides two wrong answers, leaving fewer options to choose from.", "2× points doubles your points if you answer that question correctly.", "Time freeze adds 10 seconds to your personal answering time.", "You have one use of each power-up per session. You can use more than one on the same question."], note: "Power-ups are for live quizzes; they are not part of duels or the daily question." },
  { title: "1v1 duels · Play at your own time", icon: Swords, steps: ["Open Duels on your dashboard, choose one of your quizzes and select Challenge.", "Copy the invite link from the duel page and send it to a friend.", "Your friend signs in, opens the link and selects Accept duel.", "Each of you plays the same quiz separately. Answer each timed question; you do not need to be online together.", "When both players finish, return to the duel page to compare scores and see who won."], note: "Duel invitations expire after 7 days." },
  { title: "Quick play & topic quizzes", icon: Play, steps: ["On your dashboard, choose a Quick play template for a ready-made starting point.", "For a topic quiz, type a topic into the topic builder and generate questions.", "Review the quiz and edit anything that needs correcting before launching it.", "Launch and share the code. Players follow the same rules as a live solo or team quiz."], note: "Templates and topic generation create quizzes — they are not separate scoring modes." },
  { title: "Daily question & streaks", icon: Zap, steps: ["Open the daily question on your dashboard.", "Read the question and choose one answer, then check the feedback.", "Return on consecutive days to build your streak. Check the streak shown on the dashboard."], note: "The daily question is a short individual activity, with no host or join code." },
  { title: "Challenges", icon: Trophy, steps: ["Open Challenges on your dashboard with a workspace selected.", "Choose an active challenge and select Join.", "Check that challenge's goal and end date, then complete the required activity before it ends."], note: "Challenges are set by your workspace, so goals can differ." },
  { title: "Weekly league", icon: Trophy, steps: ["Open League on your dashboard to view your workspace's weekly standings.", "Play quizzes during the week to earn points and improve your position.", "Check the table for your rank and Gold, Silver or Bronze tier."], note: "The league is a weekly ranking, not a separate quiz to launch." },
  { title: "Scheduled quizzes", icon: CalendarClock, steps: ["Open Schedule, choose one of your quizzes, and set a future date and time.", "Choose Schedule to add it to your workspace's upcoming list.", "The organiser selects Start now to open the live lobby, then shares the join code or link.", "Players join and play as a normal live quiz."], note: "Scheduling does not automatically start a game. The organiser must start it." },
];