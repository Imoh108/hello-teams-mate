import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, equipAvatar } from "@/lib/gamification.functions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trophy, ArrowLeft, Store, Flame } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — QuizPulse" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const getFn = useServerFn(getMyProfile);
  const equipFn = useServerFn(equipAvatar);
  const [state, setState] = useState<any>(null);
  const refresh = async () => setState(await getFn({}));
  useEffect(() => { refresh(); }, []);
  if (!state) return <div className="p-8 text-muted-foreground">Loading…</div>;
  const equipped = state.items.find((i: any) => i.item_id === state.profile?.equipped_avatar_id)?.avatar_items;

  const onEquip = async (itemId: string | null) => {
    try { await equipFn({ data: { itemId } }); toast.success("Equipped"); refresh(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Button asChild variant="ghost" size="sm"><Link to="/app"><ArrowLeft className="size-4 mr-1" /> Dashboard</Link></Button>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/shop"><Store className="size-4 mr-1" /> Shop</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/challenges"><Flame className="size-4 mr-1" /> Challenges</Link></Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-6 py-10 space-y-8 max-w-4xl">
        <section className="flex items-center gap-6 glass-panel rounded-xl p-6">
          <Avatar className="size-20">
            {equipped?.image_url && <AvatarImage src={equipped.image_url} />}
            <AvatarFallback>{state.profile?.display_name?.[0] ?? "U"}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold">{state.profile?.display_name ?? "Player"}</h1>
            <div className="text-3xl font-mono-tab text-primary mt-1">{state.profile?.points ?? 0} pts</div>
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold mb-3">Inventory ({state.items.length})</h2>
          {state.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items yet. Visit the <Link to="/shop" className="underline">shop</Link>.</p>
          ) : (
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              {state.items.map((it: any) => {
                const isEquipped = it.item_id === state.profile?.equipped_avatar_id;
                return (
                  <div key={it.id} className={`rounded-xl border p-3 text-center ${isEquipped ? "border-primary" : "border-border"}`}>
                    <img src={it.avatar_items?.image_url} alt={it.avatar_items?.name} className="size-20 mx-auto rounded-full object-cover" />
                    <div className="font-medium text-sm mt-2">{it.avatar_items?.name}</div>
                    <Badge variant="secondary" className="mt-1 text-[10px]">{it.avatar_items?.rarity}</Badge>
                    <Button size="sm" variant={isEquipped ? "secondary" : "outline"} className="w-full mt-2"
                      onClick={() => onEquip(isEquipped ? null : it.item_id)}>
                      {isEquipped ? "Unequip" : "Equip"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2"><Trophy className="size-5" /> Badges ({state.badges.length})</h2>
          {state.badges.length === 0 ? <p className="text-sm text-muted-foreground">No badges earned yet.</p> : (
            <div className="flex flex-wrap gap-3">
              {state.badges.map((b: any) => (
                <div key={b.id} className="rounded-xl border border-border p-3 text-center w-28">
                  <div className="text-3xl">{b.badges?.icon}</div>
                  <div className="text-xs font-medium mt-1">{b.badges?.name}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold mb-3">Recent activity</h2>
          <div className="rounded-xl border border-border divide-y divide-border">
            {state.events.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No activity.</div> :
              state.events.map((e: any) => (
                <div key={e.id} className="p-3 flex items-center justify-between text-sm">
                  <div>{e.source.replace("_", " ")}</div>
                  <div className={e.delta >= 0 ? "text-primary font-mono-tab" : "text-destructive font-mono-tab"}>
                    {e.delta >= 0 ? "+" : ""}{e.delta}
                  </div>
                </div>
              ))}
          </div>
        </section>
      </main>
    </div>
  );
}
