import { prisma } from '@/config/prisma'
import {
  COMPACT_INSPECTION_CHECKLIST,
  canonicalChecklistKey,
  scoreChecklistAnswer,
  type NormalizableChecklistItem,
} from './checklist'

export async function reconcileInspectionChecklist(sessionId: string, existingItems: NormalizableChecklistItem[]) {
  const keepIds = new Set<string>()

  await prisma.$transaction(async (tx) => {
    for (const seed of COMPACT_INSPECTION_CHECKLIST) {
      const candidate = existingItems
        .filter((item) => canonicalChecklistKey(item.itemKey) === seed.itemKey)
        .sort((a, b) => scoreChecklistAnswer(b) - scoreChecklistAnswer(a))[0]

      if (candidate) {
        keepIds.add(candidate.id)
        await tx.checklistItem.update({
          where: { id: candidate.id },
          data: {
            category: seed.category,
            itemKey: seed.itemKey,
            itemLabel: seed.itemLabel,
          },
        })
      } else {
        const created = await tx.checklistItem.create({
          data: {
            sessionId,
            ...seed,
            status: 'PENDING',
          },
        })
        keepIds.add(created.id)
      }
    }

    const staleIds = existingItems
      .filter((item) => !keepIds.has(item.id))
      .map((item) => item.id)

    if (staleIds.length > 0) {
      await tx.checklistItem.deleteMany({ where: { id: { in: staleIds } } })
    }
  })

  return prisma.inspectionSession.findUnique({
    where: { id: sessionId },
    include: { checklistItems: { orderBy: { createdAt: 'asc' } } },
  })
}
