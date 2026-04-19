// =============================================================================
// Centralized Email Sender
// All email sending goes through here — never call Resend directly from routes.
// =============================================================================

import { ResendEmailProvider } from './resend-provider'
import type { SendEmailOptions, SendEmailResult } from './provider'

let _provider: ResendEmailProvider | null = null

function getProvider(): ResendEmailProvider {
  if (!_provider) _provider = new ResendEmailProvider()
  return _provider
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const provider = getProvider()
    const result = await provider.send(options)
    if (!result.success) {
      console.error('[email] send failed:', result.error)
    }
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[email] provider error:', message)
    return { success: false, error: message }
  }
}
