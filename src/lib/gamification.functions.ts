import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---- Award points (internal-style helper, callable from client too) ----
const AwardSchema = z.object({
  orgId: z.string().uuid().nullable().optional(),
  source: z.string().min(1).max(40),
  delta: z.number().int().min(-10000).max(10000),
  refId: z.string().uuid().nullable().optional(),
});
export const awardPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AwardSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: total, error } = await supabase.rpc("award_points", {
      _user: userId,
      _org: (data.orgId ?? null) as string,
      _source: data.source,
      _delta: data.delta,
      _ref: (data.refId ?? null) as string,
    });
    if (error) throw new Error(error.message);
    return { total };
  });

// ---- Profile / wallet ----
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
    const { data: items } = await supabase.from("user_avatar_items").select("id,item_id,acquired_at,avatar_items(*)").eq("user_id", userId);
    const { data: badges } = await supabase.from("user_badges").select("id,badge_id,awarded_at,badges(*)").eq("user_id", userId);
    const { data: events } = await supabase.from("point_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
    return { profile, items: items ?? [], badges: badges ?? [], events: events ?? [] };
  });

export const equipAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ itemId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.itemId) {
      const { data: owned } = await supabase
        .from("user_avatar_items").select("id").eq("user_id", userId).eq("item_id", data.itemId).maybeSingle();
      if (!owned) throw new Error("You don't own this item.");
    }
    const { error } = await supabase.from("profiles").update({ equipped_avatar_id: data.itemId }).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Shop ----
export const listShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid().nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("avatar_items").select("*").order("cost_points");
    if (data.orgId) q = q.or(`org_id.is.null,org_id.eq.${data.orgId}`);
    else q = q.is("org_id", null);
    const { data: items, error } = await q;
    if (error) throw new Error(error.message);
    return items ?? [];
  });

export const buyItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: item } = await supabase.from("avatar_items").select("*").eq("id", data.itemId).single();
    if (!item) throw new Error("Item not found");
    const { data: profile } = await supabase.from("profiles").select("points").eq("id", userId).single();
    if (!profile || (profile.points ?? 0) < item.cost_points) throw new Error("Not enough points");
    const { data: existing } = await supabase
      .from("user_avatar_items").select("id").eq("user_id", userId).eq("item_id", data.itemId).maybeSingle();
    if (existing) throw new Error("Already owned");
    // Deduct + log via award_points (negative delta)
    const { error: ae } = await supabase.rpc("award_points", {
      _user: userId, _org: (item.org_id ?? null) as string, _source: "shop_purchase", _delta: -item.cost_points, _ref: item.id,
    });
    if (ae) throw new Error(ae.message);
    const { error: ie } = await supabase.from("user_avatar_items").insert({ user_id: userId, item_id: data.itemId });
    if (ie) throw new Error(ie.message);
    return { ok: true };
  });

// ---- Admin: item CRUD ----
const SaveItemSchema = z.object({
  id: z.string().uuid().optional(),
  orgId: z.string().uuid(),
  name: z.string().min(1).max(80),
  category: z.string().min(1).max(40),
  image_url: z.string().min(1).max(500),
  cost_points: z.number().int().min(0).max(100000),
  rarity: z.enum(["common", "rare", "epic", "legendary"]),
});
export const saveItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveItemSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      org_id: data.orgId, name: data.name, category: data.category,
      image_url: data.image_url, cost_points: data.cost_points, rarity: data.rarity, created_by: userId,
    };
    if (data.id) {
      const { error } = await supabase.from("avatar_items").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message); return { id: data.id };
    }
    const { data: row, error } = await supabase.from("avatar_items").insert(payload).select("id").single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");
    return { id: row.id };
  });
export const deleteItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("avatar_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message); return { ok: true };
  });

// ---- Admin: badges ----
const SaveBadgeSchema = z.object({
  id: z.string().uuid().optional(),
  orgId: z.string().uuid(),
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  icon: z.string().min(1).max(8),
  criteria_type: z.enum(["manual", "points_total", "quizzes_completed"]),
  criteria_value: z.number().int().min(0).max(1000000).nullable().optional(),
});
export const saveBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveBadgeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      org_id: data.orgId, name: data.name, description: data.description ?? null,
      icon: data.icon, criteria_type: data.criteria_type, criteria_value: data.criteria_value ?? null,
      created_by: userId,
    };
    if (data.id) {
      const { error } = await supabase.from("badges").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message); return { id: data.id };
    }
    const { data: row, error } = await supabase.from("badges").insert(payload).select("id").single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");
    return { id: row.id };
  });
export const deleteBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("badges").delete().eq("id", data.id);
    if (error) throw new Error(error.message); return { ok: true };
  });
export const listBadges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("badges").select("*")
      .or(`org_id.is.null,org_id.eq.${data.orgId}`).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---- Challenges ----
const SaveChallengeSchema = z.object({
  id: z.string().uuid().optional(),
  orgId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  start_at: z.string(),
  end_at: z.string(),
  target_points: z.number().int().min(1).max(1000000),
  reward_badge_id: z.string().uuid().nullable().optional(),
});
export const saveChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveChallengeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      org_id: data.orgId, name: data.name, description: data.description ?? null,
      start_at: data.start_at, end_at: data.end_at, target_points: data.target_points,
      reward_badge_id: data.reward_badge_id ?? null, created_by: userId,
    };
    if (data.id) {
      const { error } = await supabase.from("challenges").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message); return { id: data.id };
    }
    const { data: row, error } = await supabase.from("challenges").insert(payload).select("id").single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");
    return { id: row.id };
  });
export const deleteChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("challenges").delete().eq("id", data.id);
    if (error) throw new Error(error.message); return { ok: true };
  });
export const listChallenges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase.from("challenges").select("*")
      .eq("org_id", data.orgId).order("end_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.id);
    const parts = ids.length ? (await supabase.from("challenge_participants").select("*").in("challenge_id", ids).eq("user_id", userId)).data ?? [] : [];
    return (rows ?? []).map((r) => ({ ...r, participant: parts.find((p) => p.challenge_id === r.id) ?? null }));
  });
export const joinChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ challengeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("challenge_participants")
      .upsert({ challenge_id: data.challengeId, user_id: userId }, { onConflict: "challenge_id,user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
