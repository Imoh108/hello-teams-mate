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
    const repos = getRepositories("lovable_cloud");
    return repos.org.createOrganization(
      { client: context.supabase, userId: context.userId },
      data
    );
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
