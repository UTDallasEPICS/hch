import type { PrismaClient } from '../../prisma/generated/client'
import type { SessionNotesRequestKind } from '../../prisma/generated/client'

/** v1 full-notes declaration (must match what clients see before signing). */
export const DECLARATION_FULL_V1 = `I understand I am requesting access to my behavioral health session records. I specifically request the full session notes as recorded by my clinician. I confirm that I am the person making this request and that my digital signature below attests to that fact.`

/** v1 summary-only declaration. */
export const DECLARATION_SUMMARY_V1 = `I understand I am requesting access to my behavioral health session records. I specifically request a summary of my session notes (not the full clinical record). I confirm that I am the person making this request and that my digital signature below attests to that fact.`

/**
 * v2 records-request disclaimer (placeholder / generic HIPAA style).
 * TODO: replace with Adriana's final approved verbiage once provided.
 */
export const DECLARATION_FULL_V2 = `I am requesting access to my own protected health information (PHI) held by this clinic under my right of access pursuant to 45 CFR § 164.524. I specifically request the full session notes recorded by my clinician for the date range I have indicated. I understand:

• The clinic has up to fourteen (14) calendar days from the date of my signed request to approve, deny, or extend this request.
• Records I receive may contain sensitive clinical information. I am responsible for how I store, share, or disclose any copy released to me.
• Psychotherapy (process) notes maintained separately from the medical record are not required to be released under HIPAA and may be withheld or summarized.
• This request and my digital signature are retained with my clinical file as a compliance record.

I confirm that I am the individual making this request and that my digital signature below attests to my identity and agreement.`

export const DECLARATION_SUMMARY_V2 = `I am requesting a clinician-prepared summary of my protected health information (PHI) held by this clinic, in lieu of the full clinical record, under my right of access pursuant to 45 CFR § 164.524. I specifically request a summary of my session notes for the date range I have indicated (not the full clinical record). I understand:

• The clinic has up to fourteen (14) calendar days from the date of my signed request to approve, deny, or extend this request.
• The summary is prepared by clinical staff and reflects their professional judgment of what is appropriate to disclose.
• Records I receive may contain sensitive clinical information. I am responsible for how I store, share, or disclose any copy released to me.
• This request and my digital signature are retained with my clinical file as a compliance record.

I confirm that I am the individual making this request and that my digital signature below attests to my identity and agreement.`

/** Business-rule constant: SLA window admins have to act on a new records request. */
export const RECORDS_REQUEST_APPROVAL_WINDOW_DAYS = 14

/**
 * Ensures default templates exist for each request kind. Idempotent.
 * Seeds v1 (legacy) if missing, then adds v2 (current) if missing.
 */
export async function ensureDefaultDeclarationTemplates(prisma: PrismaClient): Promise<void> {
  const fullV1 = await prisma.declarationTemplate.findFirst({
    where: { requestKind: 'FULL', version: 1 },
  })
  if (!fullV1) {
    await prisma.declarationTemplate.create({
      data: { requestKind: 'FULL', version: 1, content: DECLARATION_FULL_V1 },
    })
  }

  const fullV2 = await prisma.declarationTemplate.findFirst({
    where: { requestKind: 'FULL', version: 2 },
  })
  if (!fullV2) {
    await prisma.declarationTemplate.create({
      data: { requestKind: 'FULL', version: 2, content: DECLARATION_FULL_V2 },
    })
  }

  const summaryV1 = await prisma.declarationTemplate.findFirst({
    where: { requestKind: 'SUMMARY', version: 1 },
  })
  if (!summaryV1) {
    await prisma.declarationTemplate.create({
      data: { requestKind: 'SUMMARY', version: 1, content: DECLARATION_SUMMARY_V1 },
    })
  }

  const summaryV2 = await prisma.declarationTemplate.findFirst({
    where: { requestKind: 'SUMMARY', version: 2 },
  })
  if (!summaryV2) {
    await prisma.declarationTemplate.create({
      data: { requestKind: 'SUMMARY', version: 2, content: DECLARATION_SUMMARY_V2 },
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
