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

// --- CMS ---
export interface QuestionBank {
  id: string;
  org_id: string;
  department_id: string | null;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BankQuestion {
  id: string;
  bank_id: string;
  prompt: string;
  choices: string[];
  correct_index: number;
  explanation: string | null;
  difficulty: number;
  position: number;
}

export interface BankTag {
  id: string;
  bank_id: string;
  tag: string;
}

export type DocumentStatus = "uploaded" | "parsing" | "ready" | "error";

export interface TrainingDocument {
  id: string;
  org_id: string;
  department_id: string | null;
  bank_id: string | null;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  status: DocumentStatus;
  extracted_text: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}
