import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertPlatformAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "platform_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: platform admin only");
}

export const listPlatformAdmins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "platform_admin");
    if (error) throw new Error(error.message);
    const ids = (roles ?? []).map((r) => r.user_id as string);
    if (ids.length === 0) return [];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    // fetch emails via admin api (single page)
    const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const emailById = new Map(usersPage?.users?.map((u) => [u.id, u.email ?? ""]) ?? []);
    return ids.map((id) => ({
      userId: id,
      displayName: nameById.get(id) ?? null,
      email: emailById.get(id) ?? null,
      isSelf: id === context.userId,
    }));
  });

async function findUserIdByEmail(email: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const target = email.toLowerCase().trim();
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit.id;
    if ((data.users?.length ?? 0) < 200) return null;
  }
  return null;
}

export const grantPlatformAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().email() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const uid = await findUserIdByEmail(data.email);
    if (!uid) throw new Error("No user found with that email");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: "platform_admin" });
    if (error && !String(error.message).includes("duplicate")) throw new Error(error.message);
    return { ok: true, userId: uid };
  });

export const revokePlatformAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    if (data.userId === context.userId)
      throw new Error("You cannot revoke your own platform-admin role");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "platform_admin");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const QuizDefaults = z.object({
  timer_seconds: z.number().int().min(5).max(300),
  max_players: z.number().int().min(1).max(500),
  anticheat_sensitivity: z.enum(["low", "medium", "high"]),
});
const Notifications = z.object({
  welcome_subject: z.string().min(1).max(200),
  billing_subject: z.string().min(1).max(200),
  churn_subject: z.string().min(1).max(200),
});

export const getPlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_settings")
      .select("key, value");
    if (error) throw new Error(error.message);
    const map = new Map((data ?? []).map((r) => [r.key as string, r.value]));
    return {
      quizDefaults: (map.get("quiz_defaults") as z.infer<typeof QuizDefaults>) ?? {
        timer_seconds: 20, max_players: 50, anticheat_sensitivity: "medium",
      },
      notifications: (map.get("notifications") as z.infer<typeof Notifications>) ?? {
        welcome_subject: "Welcome", billing_subject: "Invoice", churn_subject: "We miss you",
      },
    };
  });

export const updatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      quizDefaults: QuizDefaults,
      notifications: Notifications,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = [
      { key: "quiz_defaults", value: data.quizDefaults, updated_by: context.userId, updated_at: new Date().toISOString() },
      { key: "notifications", value: data.notifications, updated_by: context.userId, updated_at: new Date().toISOString() },
    ];
    const { error } = await supabaseAdmin
      .from("platform_settings")
      .upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
