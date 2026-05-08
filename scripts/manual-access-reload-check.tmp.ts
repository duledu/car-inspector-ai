import { prisma } from '../src/config/prisma'
import { getInspectionAccess, grantAccess, lockReport, startReportGeneration } from '../src/lib/inspection/access'

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
const userId = `manual-reload-${suffix}`
const vehicleIds: string[] = []
const reportIds: string[] = []

async function makeVehicle(label: string) {
  const vehicle = await prisma.vehicle.create({
    data: { userId, make: 'Manual', model: label, year: 2020 },
    select: { id: true },
  })
  vehicleIds.push(vehicle.id)
  return vehicle.id
}

async function state(vehicleId: string) {
  const access = await getInspectionAccess(userId, vehicleId)
  return `${access.status}/${access.grantedVia ?? 'null'}`
}

async function generate(vehicleId: string) {
  const claim = await startReportGeneration(userId, vehicleId)
  if (!claim.ok) return claim.reason
  if (claim.reportId) {
    reportIds.push(claim.reportId)
    await lockReport(claim.reportId, `manual-risk-${suffix}`)
  }
  return 'OK'
}

async function main() {
  await prisma.user.create({
    data: {
      id: userId,
      email: `manual-reload-${suffix}@example.invalid`,
      name: 'Manual Reload Verification',
    },
  })

  const rows: Array<{ scenario: string; before: string; generation: string; reload: string; pass: boolean }> = []

  const legacyVehicle = await makeVehicle('old vehicle')
  const legacyReport = await prisma.inspectionReport.create({
    data: { userId, vehicleId: legacyVehicle, status: 'DRAFT' },
    select: { id: true },
  })
  reportIds.push(legacyReport.id)
  const legacyBefore = await state(legacyVehicle)
  const legacyGeneration = await generate(legacyVehicle)
  const legacyReload = await state(legacyVehicle)
  rows.push({ scenario: 'old vehicle reload', before: legacyBefore, generation: legacyGeneration, reload: legacyReload, pass: legacyBefore === 'ACTIVE/legacy' && legacyReload === 'ACTIVE/legacy' })

  const promoVehicle = await makeVehicle('VIP0629')
  const promoGrant = await grantAccess(userId, promoVehicle, { grantedVia: 'promo', promoCode: 'VIP0629' })
  reportIds.push(promoGrant.id)
  const promoBefore = await state(promoVehicle)
  const promoGeneration = await generate(promoVehicle)
  const promoReload = await state(promoVehicle)
  rows.push({ scenario: 'VIP0629 reload', before: promoBefore, generation: promoGeneration, reload: promoReload, pass: promoBefore === 'ACTIVE/promo' && promoReload === 'ACTIVE/promo' })

  const purchaseVehicle = await makeVehicle('purchased access')
  const purchaseGrant = await grantAccess(userId, purchaseVehicle, { grantedVia: 'purchase', purchaseId: `manual-purchase-${suffix}` })
  reportIds.push(purchaseGrant.id)
  const purchaseBefore = await state(purchaseVehicle)
  const purchaseGeneration = await generate(purchaseVehicle)
  const purchaseReload = await state(purchaseVehicle)
  rows.push({ scenario: 'purchase reload', before: purchaseBefore, generation: purchaseGeneration, reload: purchaseReload, pass: purchaseBefore === 'ACTIVE/purchase' && purchaseReload === 'LOCKED/purchase' })

  const draftVehicle = await makeVehicle('gate DRAFT')
  const draftReport = await prisma.inspectionReport.create({
    data: { userId, vehicleId: draftVehicle, status: 'DRAFT', grantedVia: 'gate' },
    select: { id: true },
  })
  reportIds.push(draftReport.id)
  const draftBefore = await state(draftVehicle)
  const draftGeneration = await generate(draftVehicle)
  const draftReload = await state(draftVehicle)
  rows.push({ scenario: 'gate DRAFT reload', before: draftBefore, generation: draftGeneration, reload: draftReload, pass: draftBefore === 'DRAFT/gate' && draftGeneration === 'ACCESS_REQUIRED' && draftReload === 'DRAFT/gate' })

  console.table(rows)
  if (rows.some((row) => !row.pass)) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.inspectionReport.deleteMany({ where: { id: { in: reportIds } } })
    await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } })
    await prisma.user.deleteMany({ where: { id: userId } })
    await prisma.$disconnect()
  })
