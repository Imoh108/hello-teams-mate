import type { OrgRepository, RepoContext } from "../repository";
import type { Organization, Department, OrganizationMember, OrganizationInvite, OrgRole } from "../types";

// Minimal shape we need from the supabase client. Keeps DTO mapping centralized.
type SBClient = {
  from: (table: string) => any;
};

function client(ctx: RepoContext): SBClient {
  return ctx.client as SBClient;
}

export const supabaseOrgRepository: OrgRepository = {
  async createOrganization(ctx, input) {
    const sb = client(ctx);
    const { data, error } = await sb
      .from("organizations")
      .insert({ name: input.name, slug: input.slug, created_by: ctx.userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    // Add creator as owner
    const { error: mErr } = await sb
      .from("organization_members")
      .insert({ org_id: data.id, user_id: ctx.userId, org_role: "owner" });
    if (mErr) throw new Error(mErr.message);
    return data as Organization;
  },

  async listMyOrganizations(ctx) {
    const sb = client(ctx);
    const { data, error } = await sb
      .from("organization_members")
      .select("organizations:org_id ( * )")
      .eq("user_id", ctx.userId);
    if (error) throw new Error(error.message);
    return ((data ?? []).map((r: any) => r.organizations).filter(Boolean)) as Organization[];
  },

  async getOrganization(ctx, id) {
    const sb = client(ctx);
    const { data, error } = await sb.from("organizations").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as Organization | null;
  },

  async listDepartments(ctx, orgId) {
    const sb = client(ctx);
    const { data, error } = await sb.from("departments").select("*").eq("org_id", orgId).order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Department[];
  },

  async createDepartment(ctx, input) {
    const sb = client(ctx);
    const { data, error } = await sb
      .from("departments")
      .insert({ org_id: input.orgId, name: input.name, slug: input.slug })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Department;
  },

  async listMembers(ctx, orgId) {
    const sb = client(ctx);
    const { data, error } = await sb.from("organization_members").select("*").eq("org_id", orgId);
    if (error) throw new Error(error.message);
    return (data ?? []) as OrganizationMember[];
  },

  async updateMemberRole(ctx, memberId, role: OrgRole) {
    const sb = client(ctx);
    const { error } = await sb.from("organization_members").update({ org_role: role }).eq("id", memberId);
    if (error) throw new Error(error.message);
  },

  async removeMember(ctx, memberId) {
    const sb = client(ctx);
    const { error } = await sb.from("organization_members").delete().eq("id", memberId);
    if (error) throw new Error(error.message);
  },

  async createInvite(ctx, input) {
    const sb = client(ctx);
    const { data, error } = await sb
      .from("organization_invites")
      .insert({
        org_id: input.orgId,
        email: input.email.trim().toLowerCase(),
        org_role: input.role,
        department_id: input.departmentId,
        invited_by: ctx.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as OrganizationInvite;
  },

  async listInvites(ctx, orgId) {
    const sb = client(ctx);
    const { data, error } = await sb
      .from("organization_invites")
      .select("*")
      .eq("org_id", orgId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as OrganizationInvite[];
  },

  async acceptInvite(ctx, token) {
    const sb = client(ctx);
    const { data: invite, error } = await sb
      .from("organization_invites")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invite) throw new Error("Invite not found");
    if (invite.accepted_at) throw new Error("Invite already used");
    if (new Date(invite.expires_at).getTime() < Date.now()) throw new Error("Invite expired");
    const { error: mErr } = await sb.from("organization_members").upsert(
      {
        org_id: invite.org_id,
        user_id: ctx.userId,
        org_role: invite.org_role,
        department_id: invite.department_id,
      },
      { onConflict: "org_id,user_id" }
    );
    if (mErr) throw new Error(mErr.message);
    await sb.from("organization_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
    return { orgId: invite.org_id };
  },
};
