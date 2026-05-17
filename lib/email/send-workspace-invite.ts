"use client"

import emailjs from "@emailjs/browser"

import { getEmailJsConfig } from "@/lib/email/emailjs-config"
import type { InviteEmailResult, WorkspaceInviteEmailInput } from "@/lib/email/types"

function mapEmailJsError(error: unknown): InviteEmailResult {
  if (error && typeof error === "object" && "text" in error) {
    const text = String((error as { text?: string }).text ?? "")
    if (text) {
      return { ok: false, code: "template", message: text }
    }
  }
  if (error instanceof Error) {
    const msg = error.message
    if (msg.toLowerCase().includes("fetch")) {
      return {
        ok: false,
        code: "network",
        message: "Could not reach EmailJS. Check your connection and try again.",
      }
    }
    return { ok: false, code: "unknown", message: msg }
  }
  return { ok: false, code: "unknown", message: "Email delivery failed." }
}

/**
 * Sends a workspace invitation email via EmailJS (browser → EmailJS API).
 * Template variables: `email`, `workspace_name`, `invite_link`.
 */
export async function sendWorkspaceInviteEmail(
  input: WorkspaceInviteEmailInput
): Promise<InviteEmailResult> {
  const config = getEmailJsConfig()
  if (!config) {
    return {
      ok: false,
      code: "configuration",
      message:
        "EmailJS is not configured. Add NEXT_PUBLIC_EMAILJS_SERVICE_ID, NEXT_PUBLIC_EMAILJS_TEMPLATE_ID, and NEXT_PUBLIC_EMAILJS_PUBLIC_KEY to your environment.",
    }
  }

  const recipientEmail = input.recipientEmail.trim()
  if (!recipientEmail) {
    return { ok: false, code: "template", message: "Recipient email is required." }
  }

  try {
    await emailjs.send(
      config.serviceId,
      config.templateId,
      {
        email: recipientEmail,
        workspace_name: input.workspaceName,
        invite_link: input.inviteLink,
      },
      config.publicKey
    )
    return { ok: true }
  } catch (error) {
    return mapEmailJsError(error)
  }
}
