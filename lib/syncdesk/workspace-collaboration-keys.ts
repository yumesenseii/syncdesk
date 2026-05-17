export const workspaceMembersKey = (workspaceId: string) =>
  ["workspace-members", workspaceId] as const

export const workspaceInvitesKey = (workspaceId: string) =>
  ["workspace-invites", workspaceId] as const
