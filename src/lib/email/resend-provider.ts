// =============================================================================
// Resend Email Provider
// =============================================================================

import { Resend } from 'resend'
import type { EmailProvider, SendEmailOptions, SendEmailResult } from './provider'

export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend
  private readonly from: string

  constructor() {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('[email] RESEND_API_KEY environment variable is not set')
    }
    this.from = process.env.EMAIL_FROM ?? 'Used Cars Doctor <noreply@mail.usedcarsdoctor.com>'
    this.client = new Resend(apiKey)
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from:    this.from,
        to:      options.to,
        subject: options.subject,
        html:    options.html,
        ...(options.text    ? { text:    options.text    } : {}),
        ...(options.replyTo ? { replyTo: options.replyTo } : {}),
      })

      if (error) {
        console.error('[email] Resend API error:', JSON.stringify(error))
        return { success: false, error: error.message }
      }

      return { success: true, messageId: data?.id }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[email] Resend unexpected error:', message)
      return { success: false, error: message }
    }
  }
}
