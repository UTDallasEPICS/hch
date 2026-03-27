import type { PrismaClient } from '../../prisma/generated/client'
import type { SessionNotesRequestKind } from '../../prisma/generated/client'

/** v1 full-notes declaration (must match what clients see before signing). */
export const DECLARATION_FULL_V1 = `I understand I am requesting access to my behavioral health session records. I specifically request the full session notes as recorded by my clinician. I confirm that I am the person making this request and that my digital signature below attests to that fact.`

/** v1 summary-only declaration. */
export const DECLARATION_SUMMARY_V1 = `I understand I am requesting access to my behavioral health session records. I specifically request a summary of my session notes (not the full clinical record). I confirm that I am the person making this request and that my digital signature below attests to that fact.`

/**
 * Ensures default v1 templates exist for each request kind. Idempotent.
 */
export async function ensureDefaultDeclarationTemplates(prisma: PrismaClient): Promise<void> {
  const full = await prisma.declarationTemplate.findFirst({
    where: { requestKind: 'FULL' },
    orderBy: { version: 'desc' },
  })
  if (!full) {
    await prisma.declarationTemplate.create({
      data: { requestKind: 'FULL', version: 1, content: DECLARATION_FULL_V1 },
    })
  }

  const summary = await prisma.declarationTemplate.findFirst({
    where: { requestKind: 'SUMMARY' },
    orderBy: { version: 'desc' },
  })
  if (!summary) {
    await prisma.declarationTemplate.create({
      data: { requestKind: 'SUMMARY', version: 1, content: DECLARATION_SUMMARY_V1 },
    })
  }
}

/**
 * Latest template id for a request kind (highest version).
 */
export async function getLatestDeclarationTemplateId(
  prisma: PrismaClient,
  kind: SessionNotesRequestKind
): Promise<string> {
  await ensureDefaultDeclarationTemplates(prisma)
  const t = await prisma.declarationTemplate.findFirst({
    where: { requestKind: kind },
    orderBy: { version: 'desc' },
  })
  if (!t) {
    throw new Error(`No declaration template for request kind: ${kind}`)
  }
  return t.id
}

/**
 * Links legacy session_notes_request rows to the correct template after adding DeclarationTemplate.
 */
export async function backfillSessionNotesRequestTemplates(prisma: PrismaClient): Promise<void> {
  await ensureDefaultDeclarationTemplates(prisma)
  const full = await prisma.declarationTemplate.findFirst({
    where: { requestKind: 'FULL' },
    orderBy: { version: 'desc' },
  })
  const summary = await prisma.declarationTemplate.findFirst({
    where: { requestKind: 'SUMMARY' },
    orderBy: { version: 'desc' },
  })
  if (!full || !summary) return

  // Raw SQL: Prisma Client cannot filter `declarationTemplateId: null` once the field is required.
  await prisma.$executeRawUnsafe(
    `UPDATE session_notes_request SET declarationTemplateId = ? WHERE requestKind = 'FULL' AND declarationTemplateId IS NULL`,
    full.id
  )
  await prisma.$executeRawUnsafe(
    `UPDATE session_notes_request SET declarationTemplateId = ? WHERE requestKind = 'SUMMARY' AND declarationTemplateId IS NULL`,
    summary.id
  )
}
