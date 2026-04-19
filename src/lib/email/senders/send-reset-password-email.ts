import { createPasswordResetToken } from '../token-utils'
import { buildResetPasswordTemplate } from '../templates/reset-password-template'
import { sendEmail } from '../send-email'
import { getAppOrigin } from '@/utils/canonical-origin'

export interface SendResetPasswordEmailInput {
  userId: string
  to:     string
  name:   string
  lang?:  string | null
}

export async function sendResetPasswordEmail(input: SendResetPasswordEmailInput): Promise<void> {
  const token    = await createPasswordResetToken(input.userId)
  const resetUrl = `${getAppOrigin()}/auth/reset-password?token=${token}`
  const template = buildResetPasswordTemplate({ name: input.name, resetUrl, lang: input.lang })
  await sendEmail({ to: input.to, subject: template.subject, html: template.html, text: template.text })
}
