/**
 * Supabase Edge Function: send-workspace-invite
 *
 * Deploy: npx supabase functions deploy send-workspace-invite
 *
 * Secrets: RESEND_API_KEY, RESEND_FROM, INVITE_SITE_URL
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}

interface InvitePayload {
  inviteId: string
  workspaceId: string
  workspaceName: string
  inviterName: string
  inviterEmail: string
  recipientEmail: string
  role: "member" | "admin" | "viewer"
  acceptUrl: string
  message?: string | null
  expiresAt: string
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function roleLabel(role: string): string {
  const r = role.toLowerCase()
  if (r === "admin") return "Admin"
  if (r === "viewer") return "Viewer"
  return "Member"
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) {
    const err = new Error(`${name} is not set`)
    console.error(`[send-workspace-invite] missing secret/env: ${name}`)
    throw err
  }
  return value
}

function buildAcceptUrl(siteUrl: string, token: string): string {
  const base = siteUrl.replace(/\/$/, "")
  return `${base}/invite/${encodeURIComponent(token)}`
}

function inviteEmailHtml(params: {
  workspaceName: string
  inviterName: string
  roleLabel: string
  acceptUrl: string
  expiresAtFormatted: string
  messageHtml: string
}): string {
  const { workspaceName, inviterName, roleLabel, acceptUrl, expiresAtFormatted, messageHtml } =
    params
  const safeWs = escapeHtml(workspaceName)
  const safeInv = escapeHtml(inviterName)
  const safeUrl = acceptUrl.replace(/"/g, "&quot;")
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Workspace invitation — SyncDesk</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;color:#0f172a;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:620px;max-width:620px;">
          <tr>
            <td style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:36px;">
              <p style="margin:0 0 8px 0;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:#1e3a8a;">Workspace invitation</p>
              <h1 style="margin:0 0 10px 0;font-size:24px;font-weight:600;color:#0f172a;">You’re invited to ${safeWs}</h1>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#475569;">
                <strong style="color:#0f172a;">${safeInv}</strong> invited you to collaborate on SyncDesk as <strong style="color:#0f172a;">${escapeHtml(roleLabel)}</strong>.
              </p>
              ${messageHtml}
              <p style="margin:16px 0;">
                <a href="${safeUrl}" style="display:inline-block;background-color:#2563eb;color:#ffffff;font-size:15px;font-weight:600;padding:14px 28px;border-radius:12px;text-decoration:none;">Accept invitation</a>
              </p>
              <p style="margin:0;font-size:12px;line-height:18px;color:#64748b;">
                This link expires on <strong style="color:#0f172a;">${escapeHtml(expiresAtFormatted)}</strong>.
              </p>
              <p style="margin:16px 0 0 0;font-size:12px;line-height:18px;color:#94a3b8;">
                Button not working? Paste into your browser:<br />
                <a href="${safeUrl}" style="color:#2563eb;word-break:break-all;">${escapeHtml(acceptUrl)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function sendWithResend(params: {
  from: string
  apiKey: string
  to: string
  subject: string
  html: string
  replyTo: string
}): Promise<void> {
  console.log("[send-workspace-invite] sending email via Resend", {
    to: params.to,
    from: params.from,
    subject: params.subject,
  })

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      reply_to: params.replyTo,
    }),
  })

  const body = await res.text()
  if (!res.ok) {
    console.error("[send-workspace-invite] Resend API error", {
      status: res.status,
      body,
    })
    let detail = body
    try {
      const parsed = JSON.parse(body) as { message?: string }
      if (parsed?.message) detail = parsed.message
    } catch {
      /* use raw body */
    }
    throw new Error(detail || `Resend API returned ${res.status}`)
  }

  console.log("[send-workspace-invite] Resend accepted email", { status: res.status })
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405)
  }

  try {
    const RESEND_API_KEY = requireEnv("RESEND_API_KEY")
    const RESEND_FROM = requireEnv("RESEND_FROM")
    const INVITE_SITE_URL = requireEnv("INVITE_SITE_URL")

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[send-workspace-invite] missing SUPABASE_URL or SUPABASE_ANON_KEY")
      throw new Error("Server misconfiguration: missing Supabase environment.")
    }

    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[send-workspace-invite] missing or invalid Authorization header")
      return json({ error: "Unauthorized", code: "unauthorized" }, 401)
    }

    let payload: InvitePayload
    try {
      payload = (await req.json()) as InvitePayload
    } catch (parseErr) {
      console.error("[send-workspace-invite] invalid JSON body", parseErr)
      return json({ error: "Invalid JSON body.", code: "invalid-payload" }, 400)
    }

    console.log("[send-workspace-invite] request received", {
      inviteId: payload?.inviteId,
      recipientEmail: payload?.recipientEmail,
    })

    if (!payload?.inviteId || !payload?.recipientEmail) {
      return json({ error: "Missing inviteId or recipientEmail.", code: "invalid-payload" }, 400)
    }

    const recipient = payload.recipientEmail.trim()
    if (!isValidEmail(recipient)) {
      return json({ error: "Invalid recipient email address.", code: "invalid-recipient" }, 400)
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr || !user?.id) {
      console.error("[send-workspace-invite] auth.getUser failed", userErr)
      return json({ error: "Unauthorized", code: "unauthorized" }, 401)
    }

    const { data: invite, error: invErr } = await supabase
      .from("workspace_invites")
      .select("id, invited_by, invited_email, role, token, message, expires_at, status, workspace_id")
      .eq("id", payload.inviteId)
      .maybeSingle()

    if (invErr) {
      console.error("[send-workspace-invite] invite lookup failed", invErr)
      throw new Error(invErr.message)
    }
    if (!invite) {
      return json({ error: "Invitation not found or access denied.", code: "invite-not-found" }, 403)
    }
    if (String(invite.invited_by) !== String(user.id)) {
      return json({ error: "You can only send email for your own invitations.", code: "forbidden" }, 403)
    }
    if (invite.status !== "pending") {
      return json({ error: "Only pending invitations can be emailed.", code: "invalid-status" }, 400)
    }
    if (recipient.toLowerCase() !== String(invite.invited_email).trim().toLowerCase()) {
      return json({ error: "Recipient does not match the invitation record.", code: "recipient-mismatch" }, 400)
    }

    const { data: ws, error: wsErr } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", invite.workspace_id)
      .maybeSingle()

    if (wsErr) {
      console.error("[send-workspace-invite] workspace lookup failed", wsErr)
      throw new Error(wsErr.message)
    }

    const workspaceName =
      (ws as { name?: string } | null)?.name?.trim() || payload.workspaceName?.trim() || "Workspace"
    const inviterName = payload.inviterName?.trim() || user.email?.split("@")[0] || "A teammate"
    const inviterEmail = payload.inviterEmail?.trim() || user.email || ""
    const role = (invite.role ?? payload.role ?? "member") as "member" | "admin" | "viewer"
    const expiresAt = invite.expires_at ?? payload.expiresAt
    const expiresAtFormatted = new Date(expiresAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })

    const acceptUrl = buildAcceptUrl(INVITE_SITE_URL, invite.token)
    const note = invite.message
      ? `<table role="presentation" width="100%" style="margin:12px 0 16px 0;"><tr><td style="padding:12px 14px;border-left:3px solid #2563eb;background-color:#f8fafc;border-radius:0 10px 10px 0;font-size:14px;line-height:22px;color:#334155;">${escapeHtml(String(invite.message))}</td></tr></table>`
      : ""

    const html = inviteEmailHtml({
      workspaceName,
      inviterName,
      roleLabel: roleLabel(role),
      acceptUrl,
      expiresAtFormatted,
      messageHtml: note,
    })

    const subject = `${inviterName} invited you to ${workspaceName} on SyncDesk`

    await sendWithResend({
      from: RESEND_FROM,
      apiKey: RESEND_API_KEY,
      to: recipient,
      subject,
      html,
      replyTo: inviterEmail || recipient,
    })

    console.log("[send-workspace-invite] success", { inviteId: payload.inviteId, to: recipient })
    return json({ success: true }, 200)
  } catch (err) {
    console.error("[send-workspace-invite] unhandled error", err)
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: message, code: "internal" }, 500)
  }
})
