import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listShop, buyItem, getMyProfile } from "@/lib/gamification.functions";
import { useCurrentOrgId } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Coins, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({ meta: [{ title: "Shop — QuizPulse" }] }),
  component: ShopPage,
});

function ShopPage() {
  const [orgId] = useCurrentOrgId();
  const shopFn = useServerFn(listShop);
  const buyFn = useServerFn(buyItem);
  const meFn = useServerFn(getMyProfile);
  const [items, setItems] = useState<any[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [points, setPoints] = useState(0);

  const refresh = async () => {
    const [list, me] = await Promise.all([shopFn({ data: { orgId: orgId ?? null } }), meFn({})]);
    setItems(list as any);
    setOwned(new Set((me as any).items.map((i: any) => i.item_id)));
    setPoints((me as any).profile?.points ?? 0);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [orgId]);

  const onBuy = async (id: string) => {
    try { await buyFn({ data: { itemId: id } }); toast.success("Purchased!"); refresh(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Button asChild variant="ghost" size="sm"><Link to="/profile"><ArrowLeft className="size-4 mr-1" /> Profile</Link></Button>
          <div className="flex items-center gap-2 font-mono-tab text-primary">
            <Coins className="size-4" /> {points} pts
          </div>
        </div>
      </header>
      <main className="container mx-auto px-6 py-10 max-w-5xl">
        <h1 className="font-display text-3xl font-bold mb-6">Avatar shop</h1>
        {items.length === 0 ? (
          <p className="text-muted-foreground">Nothing in the shop yet.</p>
        ) : (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {items.map((it) => {
              const isOwned = owned.has(it.id);
              const canAfford = points >= it.cost_points;
              return (
                <div key={it.id} className="glass-panel rounded-xl p-4 text-center">
                  <img src={it.image_url} alt={it.name} className="size-24 mx-auto rounded-full object-cover" />
                  <div className="font-display font-semibold mt-2">{it.name}</div>
                  <Badge variant="secondary" className="mt-1 text-[10px]">{it.rarity}</Badge>
                  <div className="mt-2 font-mono-tab text-primary flex items-center justify-center gap-1">
                    <Coins className="size-3" /> {it.cost_points}
                  </div>
                  <Button disabled={isOwned || !canAfford} onClick={() => onBuy(it.id)} size="sm" className="w-full mt-3">
                    {isOwned ? "Owned" : canAfford ? "Buy" : <><Lock className="size-3 mr-1" /> Need {it.cost_points - points}</>}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
