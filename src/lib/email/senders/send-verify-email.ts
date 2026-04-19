import { createEmailVerificationToken } from '../token-utils'
import { buildVerifyEmailTemplate } from '../templates/verify-email-template'
import { sendEmail } from '../send-email'
import { getAppOrigin } from '@/utils/canonical-origin'
import type { SendEmailResult } from '../provider'

export interface SendVerifyEmailInput {
  userId: string
  to:     string
  name:   string
  lang?:  string | null
}

export async function sendVerifyEmail(input: SendVerifyEmailInput): Promise<SendEmailResult> {
  console.log(`[email/verify] creating token userId=${input.userId}`)
  const token     = await createEmailVerificationToken(input.userId)
  const verifyUrl = `${getAppOrigin()}/auth/verify-email?token=${token}`
  const template  = buildVerifyEmailTemplate({ name: input.name, verifyUrl, lang: input.lang })
  console.log(`[email/verify] dispatching to=${input.to}`)
  const result    = await sendEmail({ to: input.to, subject: template.subject, html: template.html, text: template.text })
  if (result.success) {
    console.log(`[email/verify] delivered messageId=${result.messageId}`)
  } else {
    console.error(`[email/verify] delivery failed: ${result.error}`)
  }
  return result
}
