import type { Repositories } from "./repository";
import { supabaseOrgRepository } from "./supabase/org.repo";
import { dataverseOrgRepositoryStub } from "./dataverse/stub.repo";
import type { DataBackend } from "./types";

// Pick a repository implementation based on the org's configured backend.
// Today everything is Lovable Cloud (Supabase). The Dataverse seam exists so
// enterprise tenants can later route to their own M365 tenant without rewriting
// the server functions.
export function getRepositories(backend: DataBackend = "lovable_cloud"): Repositories {
  switch (backend) {
    case "dataverse":
      return { org: dataverseOrgRepositoryStub };
    case "lovable_cloud":
    default:
      return { org: supabaseOrgRepository };
  }
}

export type { Repositories } from "./repository";
export * from "./types";
