import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getRepositories } from "@/lib/data";
import type { OrgRole } from "@/lib/data/types";

const SlugSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, hyphens");

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().min(1).max(120), slug: SlugSchema }).parse(d)
  )
  .handler(async ({ data, context }) => {
    // Caller is verified by requireSupabaseAuth. Use the admin client so org
    // creation works even when RLS/JWT verification is mid-rotation; we pin
    // created_by to the verified user id so the row is still owned correctly.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: org, error } = await supabaseAdmin
      .from("organizations")
      .insert({ name: data.name, slug: data.slug, created_by: context.userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const { error: mErr } = await supabaseAdmin
      .from("organization_members")
      .insert({ org_id: org.id, user_id: context.userId, org_role: "owner" });
    if (mErr) throw new Error(mErr.message);
    return org;
  });

export const listMyOrganizations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const repos = getRepositories("lovable_cloud");
    return repos.org.listMyOrganizations({ client: context.supabase, userId: context.userId });
  });

export const getOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const repos = getRepositories("lovable_cloud");
    return repos.org.getOrganization({ client: context.supabase, userId: context.userId }, data.id);
  });

export const listDepartments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const repos = getRepositories("lovable_cloud");
    return repos.org.listDepartments(
      { client: context.supabase, userId: context.userId },
      data.orgId
    );
  });

export const createDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ orgId: z.string().uuid(), name: z.string().min(1).max(80), slug: SlugSchema })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const repos = getRepositories("lovable_cloud");
    return repos.org.createDepartment(
      { client: context.supabase, userId: context.userId },
      data
    );
  });

export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const repos = getRepositories("lovable_cloud");
    return repos.org.listMembers(
      { client: context.supabase, userId: context.userId },
      data.orgId
    );
  });

const RoleEnum = z.enum(["owner", "admin", "hr", "team_lead", "member"]);

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ memberId: z.string().uuid(), role: RoleEnum }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const repos = getRepositories("lovable_cloud");
    await repos.org.updateMemberRole(
      { client: context.supabase, userId: context.userId },
      data.memberId,
      data.role as OrgRole
    );
    return { ok: true };
  });

export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        email: z.string().email().max(255),
        role: RoleEnum.default("member"),
        departmentId: z.string().uuid().nullable().default(null),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const repos = getRepositories("lovable_cloud");
    return repos.org.createInvite(
      { client: context.supabase, userId: context.userId },
      {
        orgId: data.orgId,
        email: data.email,
        role: data.role as OrgRole,
        departmentId: data.departmentId,
      }
    );
  });

export const listInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const repos = getRepositories("lovable_cloud");
    return repos.org.listInvites(
      { client: context.supabase, userId: context.userId },
      data.orgId
    );
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(d))
  .handler(async ({ data, context }) => {
    const repos = getRepositories("lovable_cloud");
    return repos.org.acceptInvite(
      { client: context.supabase, userId: context.userId },
      data.token
    );
  });

// ---------- Tier management ----------

const TierEnum = z.enum(["basic", "premium", "enterprise"]);

export const getOrgTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("organizations")
      .select("subscription_tier")
      .eq("id", data.orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { tier: (row?.subscription_tier ?? "basic") as "basic" | "premium" | "enterprise" };
  });

export const setOrgTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), tier: TierEnum }).parse(d)
  )
  .handler(async ({ data, context }) => {
    // Only owners can change tier
    const { data: isOwner, error: roleErr } = await context.supabase
      .rpc("has_org_role", { _org: data.orgId, _user: context.userId, _role: "owner" });
    if (roleErr) throw new Error(roleErr.message);
    if (!isOwner) throw new Error("Only the organization owner can change the subscription tier.");
    const { error } = await context.supabase
      .from("organizations")
      .update({ subscription_tier: data.tier })
      .eq("id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true, tier: data.tier };
  });
