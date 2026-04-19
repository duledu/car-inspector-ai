import { createEmailVerificationToken } from '../token-utils'
import { buildVerifyEmailTemplate } from '../templates/verify-email-template'
import { sendEmail } from '../send-email'
import { getAppOrigin } from '@/utils/canonical-origin'

export interface SendVerifyEmailInput {
  userId: string
  to:     string
  name:   string
  lang?:  string | null
}

export async function sendVerifyEmail(input: SendVerifyEmailInput): Promise<void> {
  const token     = await createEmailVerificationToken(input.userId)
  const verifyUrl = `${getAppOrigin()}/auth/verify-email?token=${token}`
  const template  = buildVerifyEmailTemplate({ name: input.name, verifyUrl, lang: input.lang })
  await sendEmail({ to: input.to, subject: template.subject, html: template.html, text: template.text })
}
