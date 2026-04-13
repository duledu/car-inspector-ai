import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

const BodySchema = z.object({ vehicleId: z.string() })

// Default checklist items seeded when a new session is created
const DEFAULT_CHECKLIST = [
  // PRE_SCREENING
  { category: 'PRE_SCREENING' as const, itemKey: 'pre_price', itemLabel: 'Check asking price vs market value' },
  { category: 'PRE_SCREENING' as const, itemKey: 'pre_history', itemLabel: 'Research seller and listing history' },
  { category: 'PRE_SCREENING' as const, itemKey: 'pre_recall', itemLabel: 'Check for open manufacturer recalls' },
  { category: 'PRE_SCREENING' as const, itemKey: 'pre_service', itemLabel: 'Request service records from seller' },
  { category: 'PRE_SCREENING' as const, itemKey: 'pre_photos', itemLabel: 'Review all listing photos carefully' },
  // EXTERIOR
  { category: 'EXTERIOR' as const, itemKey: 'ext_paint', itemLabel: 'Overall paint condition and consistency' },
  { category: 'EXTERIOR' as const, itemKey: 'ext_panels', itemLabel: 'Panel gaps are even and consistent' },
  { category: 'EXTERIOR' as const, itemKey: 'ext_rust', itemLabel: 'Underbody and wheel arch rust check' },
  { category: 'EXTERIOR' as const, itemKey: 'ext_glass', itemLabel: 'Windshield and glass condition' },
  { category: 'EXTERIOR' as const, itemKey: 'ext_tires', itemLabel: 'Tire wear pattern and remaining depth' },
  { category: 'EXTERIOR' as const, itemKey: 'ext_lights', itemLabel: 'All lights functional (front and rear)' },
  { category: 'EXTERIOR' as const, itemKey: 'ext_dents', itemLabel: 'Body panel dents or accident repair signs' },
  // INTERIOR
  { category: 'INTERIOR' as const, itemKey: 'int_seats', itemLabel: 'Seats and upholstery condition' },
  { category: 'INTERIOR' as const, itemKey: 'int_dash', itemLabel: 'Dashboard, controls, and warning lights' },
  { category: 'INTERIOR' as const, itemKey: 'int_odometer', itemLabel: 'Odometer reading and consistency' },
  { category: 'INTERIOR' as const, itemKey: 'int_ac', itemLabel: 'Air conditioning and heating system' },
  { category: 'INTERIOR' as const, itemKey: 'int_infotainment', itemLabel: 'Infotainment and electronics' },
  { category: 'INTERIOR' as const, itemKey: 'int_smell', itemLabel: 'No unusual smells (mold, oil, burn)' },
  // MECHANICAL
  { category: 'MECHANICAL' as const, itemKey: 'mech_start', itemLabel: 'Cold start behavior and idle quality' },
  { category: 'MECHANICAL' as const, itemKey: 'mech_noise', itemLabel: 'Engine noise and vibration at idle' },
  { category: 'MECHANICAL' as const, itemKey: 'mech_oil', itemLabel: 'Oil condition and level check' },
  { category: 'MECHANICAL' as const, itemKey: 'mech_trans', itemLabel: 'Transmission smoothness (all gears)' },
  { category: 'MECHANICAL' as const, itemKey: 'mech_brakes', itemLabel: 'Brake condition and pedal feel' },
  { category: 'MECHANICAL' as const, itemKey: 'mech_suspension', itemLabel: 'Suspension and shock absorbers' },
  { category: 'MECHANICAL' as const, itemKey: 'mech_exhaust', itemLabel: 'Exhaust system condition and emissions' },
  { category: 'MECHANICAL' as const, itemKey: 'mech_coolant', itemLabel: 'Coolant level and condition' },
  // TEST_DRIVE
  { category: 'TEST_DRIVE' as const, itemKey: 'td_accel', itemLabel: 'Acceleration response and power delivery' },
  { category: 'TEST_DRIVE' as const, itemKey: 'td_brake', itemLabel: 'Braking performance and ABS function' },
  { category: 'TEST_DRIVE' as const, itemKey: 'td_steering', itemLabel: 'Steering alignment and feel' },
  { category: 'TEST_DRIVE' as const, itemKey: 'td_trans', itemLabel: 'Transmission shifts under load' },
  { category: 'TEST_DRIVE' as const, itemKey: 'td_suspension', itemLabel: 'Suspension comfort over bumps' },
  { category: 'TEST_DRIVE' as const, itemKey: 'td_sounds', itemLabel: 'No abnormal sounds during drive' },
  // DOCUMENTS
  { category: 'DOCUMENTS' as const, itemKey: 'doc_title', itemLabel: 'Title status is clean and correct' },
  { category: 'DOCUMENTS' as const, itemKey: 'doc_reg', itemLabel: 'Registration is current and matches' },
  { category: 'DOCUMENTS' as const, itemKey: 'doc_vin', itemLabel: 'VIN matches on plate, dash, and docs' },
  { category: 'DOCUMENTS' as const, itemKey: 'doc_service', itemLabel: 'Service records present and consistent' },
  { category: 'DOCUMENTS' as const, itemKey: 'doc_insurance', itemLabel: 'Insurance history available' },
]

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid JSON', { status: 400, code: 'BAD_REQUEST' })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return apiError('vehicleId is required', { status: 400, code: 'VALIDATION_ERROR' })
  }

  const { vehicleId } = parsed.data

  try {
    // Verify vehicle belongs to user
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, userId: auth.userId } })
    if (!vehicle) return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })

    // Return existing session if found
    const existing = await prisma.inspectionSession.findFirst({
      where: { userId: auth.userId, vehicleId },
      include: { checklistItems: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })

    if (existing) {
      return NextResponse.json({ data: existing })
    }

    // Create new session with seeded checklist items
    const session = await prisma.inspectionSession.create({
      data: {
        userId: auth.userId,
        vehicleId,
        phase: 'PRE_SCREENING',
        checklistItems: {
          create: DEFAULT_CHECKLIST.map((item) => ({
            ...item,
            status: 'PENDING',
          })),
        },
      },
      include: { checklistItems: { orderBy: { createdAt: 'asc' } } },
    })

    return NextResponse.json({ data: session }, { status: 201 })
  } catch (err) {
    logApiError('inspection/session', 'getOrCreateSession', err, { vehicleId })
    return apiError('Failed to load inspection session', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
