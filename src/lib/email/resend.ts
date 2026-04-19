import { Resend } from 'resend'

let _client: Resend | null = null

export function getResendClient(): Resend {
  if (_client) return _client
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('[email] RESEND_API_KEY is not set')
  _client = new Resend(apiKey)
  return _client
}

export const getEmailFrom = (): string =>
  process.env.EMAIL_FROM ?? 'Used Cars Doctor <noreply@mail.usedcarsdoctor.com>'
