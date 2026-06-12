// Domain DTOs — kept free of any backend-specific types so the
// data layer can be swapped (Lovable Cloud today, Microsoft Dataverse later).

export type OrgRole = "owner" | "admin" | "hr" | "team_lead" | "member";
export type DataBackend = "lovable_cloud" | "dataverse";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  default_locale: string;
  data_backend: DataBackend;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  org_id: string;
  name: string;
  slug: string;
}

export interface OrganizationMember {
  id: string;
  org_id: string;
  user_id: string;
  org_role: OrgRole;
  department_id: string | null;
}

export interface OrganizationInvite {
  id: string;
  org_id: string;
  email: string;
  token: string;
  org_role: OrgRole;
  department_id: string | null;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}
