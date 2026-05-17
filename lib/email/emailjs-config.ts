export type EmailJsConfig = {
  serviceId: string
  templateId: string
  publicKey: string
}

/**
 * Reads EmailJS public env vars (safe for client bundles on Vercel).
 */
export function getEmailJsConfig(): EmailJsConfig | null {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID?.trim() ?? ""
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID?.trim() ?? ""
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY?.trim() ?? ""
  if (!serviceId || !templateId || !publicKey) return null
  return { serviceId, templateId, publicKey }
}

export function isEmailJsConfigured(): boolean {
  return getEmailJsConfig() !== null
}
