import type {
  Organization,
  Department,
  OrganizationMember,
  OrganizationInvite,
  OrgRole,
} from "./types";

export interface RepoContext {
  // Any client honoring the calling user's identity (RLS-aware for Supabase).
  // Typed loosely on purpose so alternate backends can substitute their own client.
  client: unknown;
  userId: string;
}

export interface OrgRepository {
  createOrganization(ctx: RepoContext, input: { name: string; slug: string }): Promise<Organization>;
  listMyOrganizations(ctx: RepoContext): Promise<Organization[]>;
  getOrganization(ctx: RepoContext, id: string): Promise<Organization | null>;

  listDepartments(ctx: RepoContext, orgId: string): Promise<Department[]>;
  createDepartment(ctx: RepoContext, input: { orgId: string; name: string; slug: string }): Promise<Department>;

  listMembers(ctx: RepoContext, orgId: string): Promise<OrganizationMember[]>;
  updateMemberRole(ctx: RepoContext, memberId: string, role: OrgRole): Promise<void>;
  removeMember(ctx: RepoContext, memberId: string): Promise<void>;

  createInvite(ctx: RepoContext, input: {
    orgId: string;
    email: string;
    role: OrgRole;
    departmentId: string | null;
  }): Promise<OrganizationInvite>;
  listInvites(ctx: RepoContext, orgId: string): Promise<OrganizationInvite[]>;
  acceptInvite(ctx: RepoContext, token: string): Promise<{ orgId: string }>;
}

export interface Repositories {
  org: OrgRepository;
}
