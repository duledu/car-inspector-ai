import crypto from 'crypto'
import { prisma } from '@/config/prisma'

const VERIFY_TTL_MS  = 24 * 60 * 60 * 1000  // 24 hours
const RESET_TTL_MS   =      60 * 60 * 1000  // 1 hour

export async function createEmailVerificationToken(userId: string): Promise<string> {
  // Invalidate any existing tokens for this user
  await prisma.emailVerificationToken.deleteMany({ where: { userId } })

  const token = crypto.randomBytes(32).toString('hex')
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
    },
  })
  return token
}

export async function consumeEmailVerificationToken(
  token: string
): Promise<{ userId: string } | { error: 'not_found' | 'expired' }> {
  const record = await prisma.emailVerificationToken.findUnique({ where: { token } })
  if (!record) return { error: 'not_found' }
  if (record.expiresAt < new Date()) {
    await prisma.emailVerificationToken.delete({ where: { token } })
    return { error: 'expired' }
  }
  await prisma.emailVerificationToken.delete({ where: { token } })
  return { userId: record.userId }
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  // Invalidate any existing reset tokens for this user
  await prisma.passwordResetToken.deleteMany({ where: { userId } })

  const token = crypto.randomBytes(32).toString('hex')
  await prisma.passwordResetToken.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  })
  return token
}

export async function consumePasswordResetToken(
  token: string
): Promise<{ userId: string } | { error: 'not_found' | 'expired' | 'used' }> {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } })
  if (!record) return { error: 'not_found' }
  if (record.usedAt) return { error: 'used' }
  if (record.expiresAt < new Date()) {
    await prisma.passwordResetToken.delete({ where: { token } })
    return { error: 'expired' }
  }
  await prisma.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } })
  return { userId: record.userId }
}
