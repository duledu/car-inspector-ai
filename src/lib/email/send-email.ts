// =============================================================================
// Centralized Email Sender
// All email sending goes through here — never call Resend directly from routes.
// =============================================================================

import type { EmailProvider, SendEmailOptions, SendEmailResult } from './provider'

let _provider: EmailProvider | null = null

function getProvider(): EmailProvider {
  if (_provider) return _provider
  // Lazy import so the module is only loaded server-side
  const { ResendEmailProvider } = require('./resend-provider') as typeof import('./resend-provider')
  _provider = new ResendEmailProvider()
  return _provider
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const provider = getProvider()
    const result = await provider.send(options)
    if (!result.success) {
      console.error('[email] send failed:', { to: options.to, subject: options.subject, error: result.error })
    }
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Configuration errors (missing API key) should not crash the caller
    console.error('[email] provider initialisation error:', message)
    return { success: false, error: message }
  }
}
