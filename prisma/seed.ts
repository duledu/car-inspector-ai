// =============================================================================
// Prisma Seed — creates a default dev user if none exists
// Run: npm run db:seed
// =============================================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'duledu25@gmail.com'
  const password = 'duledu25'

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`User ${email} already exists — skipping seed.`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Dusan Stevanovic',
      passwordHash,
      role: 'USER',
    },
  })

  console.log(`✔ Created user: ${user.email} (id: ${user.id})`)
  console.log(`  Password: ${password}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
