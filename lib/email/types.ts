export type InviteEmailErrorCode =
  | "configuration"
  | "network"
  | "template"
  | "unknown"

export type InviteEmailResult =
  | { ok: true }
  | {
      ok: false
      code: InviteEmailErrorCode
      message: string
    }

export type WorkspaceInviteEmailInput = {
  recipientEmail: string
  workspaceName: string
  inviteLink: string
}
