import type { OrgRepository } from "../repository";

// Placeholder for the future Microsoft Dataverse adapter.
// Activates when organizations.data_backend === 'dataverse'.
function notImplemented(method: string): never {
  throw new Error(
    `Microsoft Dataverse backend not yet implemented (${method}). ` +
      `Switch the organization's data_backend back to 'lovable_cloud' or finish the Dataverse adapter.`
  );
}

export const dataverseOrgRepositoryStub: OrgRepository = {
  createOrganization: () => notImplemented("createOrganization"),
  listMyOrganizations: () => notImplemented("listMyOrganizations"),
  getOrganization: () => notImplemented("getOrganization"),
  listDepartments: () => notImplemented("listDepartments"),
  createDepartment: () => notImplemented("createDepartment"),
  listMembers: () => notImplemented("listMembers"),
  updateMemberRole: () => notImplemented("updateMemberRole"),
  removeMember: () => notImplemented("removeMember"),
  createInvite: () => notImplemented("createInvite"),
  listInvites: () => notImplemented("listInvites"),
  acceptInvite: () => notImplemented("acceptInvite"),
};
