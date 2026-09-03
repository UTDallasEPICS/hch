/**
 * Utilities for determining status-specific client form completion.
 * Prospective required: Application + Physician Statement upload + ROI upload.
 * Waitlist required: ACE + GAD-7 + PHQ-9 + PCL-5.
 */
import type { PrismaClient } from '../../prisma/generated/client'
import type { ClientStatus } from '../../prisma/generated/client'
import { toDbClientStatus } from './client-status'

const ACE_QUESTION_COUNT = 10
const GAD_QUESTION_COUNT = 7

export const FORM_LABELS: Record<string, string> = {
  application: 'Application',
  physicianStatement: 'Physician Statement (PDF Upload)',
  releaseOfInformationAuthorization: 'Release of Information Authorization (PDF Upload)',
  ace: 'ACE',
  gad: 'GAD-7',
  phq: 'PHQ-9',
  pcl: 'PCL-5',
}

/**
 * Clinical assessments only — same keys we clear server-side when emailing a fresh form link.
 * Not used for application, physician statement, or ROI (those are not emailed / reset this way).
 */
export const SENDABLE_EMAIL_FORM_KEYS = ['ace', 'gad', 'phq', 'pcl'] as const

export type SendableEmailFormKey = (typeof SENDABLE_EMAIL_FORM_KEYS)[number]

const SENDABLE_SET = new Set<string>(SENDABLE_EMAIL_FORM_KEYS)

export function isSendableEmailFormKey(k: string): k is SendableEmailFormKey {
  return SENDABLE_SET.has(k)
}

const CLINICAL_FORM_PATHS: Record<SendableEmailFormKey, string> = {
  ace: '/forms/ace-form',
  gad: '/forms/gad',
  phq: '/forms/phq',
  pcl: '/forms/pcl',
}

/**
 * Resolves absolute URLs for reminder emails (entry pages; ACE always questionnaire, not results).
 */
export async function resolveClientFormLinkEntries(
  _prisma: PrismaClient,
  _userId: string,
  keys: string[]
): Promise<{ key: string; label: string; href: string }[]> {
  const unique = [...new Set(keys)]
  const invalid = unique.filter((k) => !SENDABLE_SET.has(k))
  if (invalid.length) {
    throw new Error(`Invalid form key(s): ${invalid.join(', ')}`)
  }

  const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
  const out: { key: string; label: string; href: string }[] = []
  for (const key of unique as SendableEmailFormKey[]) {
    const label = FORM_LABELS[key] ?? key
    out.push({ key, label, href: `${base}${CLINICAL_FORM_PATHS[key]}` })
  }
  return out
}

/** Deletes stored form data so the client sees an empty assessment when they open the link. */
export async function resetClientFormDataForEmail(
  db: PrismaClient,
  userId: string,
  key: SendableEmailFormKey
): Promise<void> {
  switch (key) {
    case 'ace':
      await db.aceForm.deleteMany({ where: { userId } })
      return
    case 'gad':
      await db.gadForm.deleteMany({ where: { userId } })
      return
    case 'phq':
      await db.phqForm.deleteMany({ where: { userId } })
      return
    case 'pcl':
      await db.pclForm.deleteMany({ where: { userId } })
      return
  }
}

export async function getIncompleteForms(
  prisma: PrismaClient,
  userId: string,
  status: ClientStatus | string = 'INCOMPLETE'
): Promise<string[]> {
  const normalizedStatus = toDbClientStatus(status)

  if (normalizedStatus === 'WAITLIST') {
    return getWaitlistIncompleteForms(prisma, userId)
  }

  const incomplete: string[] = []
  const [appForm, physicianStatementForm, roiForm] = await Promise.all([
    prisma.appForm.findFirst({
      where: { userId },
      orderBy: { id: 'desc' },
    }),
    prisma.physicianStatementForm.findUnique({
      where: { userId },
      select: { status: true },
    }),
    prisma.releaseOfInformationAuthorizationForm.findUnique({
      where: { userId },
      select: { status: true },
    }),
  ])

  if (appForm?.status !== 'COMPLETE') {
    incomplete.push('application')
  }
  if (physicianStatementForm?.status !== 'SUBMITTED') {
    incomplete.push('physicianStatement')
  }
  if (roiForm?.status !== 'SUBMITTED') {
    incomplete.push('releaseOfInformationAuthorization')
  }

  return incomplete
}

/** Prospective requirements for moving to waitlist. */
export async function isPreWaitlistComplete(
  prisma: PrismaClient,
  userId: string
): Promise<boolean> {
  const incomplete = await getIncompleteForms(prisma, userId, 'INCOMPLETE')
  return incomplete.length === 0
}

/** Prospective incomplete forms (Application + 2 upload tasks). */
export async function getPreWaitlistIncompleteForms(
  prisma: PrismaClient,
  userId: string
): Promise<string[]> {
  return getIncompleteForms(prisma, userId, 'INCOMPLETE')
}

/** Waitlist completion: ACE, GAD-7, PHQ-9, PCL-5 required. */
export async function isWaitlistFormsComplete(
  prisma: PrismaClient,
  userId: string
): Promise<boolean> {
  const incomplete = await getWaitlistIncompleteForms(prisma, userId)
  return incomplete.length === 0
}

export async function getWaitlistIncompleteForms(
  prisma: PrismaClient,
  userId: string
): Promise<string[]> {
  const incomplete: string[] = []
  const [aceForm, gadForm, phqForm, pclForm] = await Promise.all([
    prisma.aceForm.findFirst({
      where: { userId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    }),
    prisma.gadForm.findFirst({
      where: { userId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    }),
    prisma.phqForm.findFirst({
      where: { userId },
    }),
    prisma.pclForm.findFirst({
      where: { userId },
      orderBy: { id: 'desc' },
    }),
  ])

  if (phqForm?.status !== 'COMPLETE') {
    incomplete.push('phq')
  }
  if (pclForm?.status !== 'COMPLETE') {
    incomplete.push('pcl')
  }

  if (aceForm?.status !== 'COMPLETE') {
    incomplete.push('ace')
  }

  const gadQuestions = gadForm?.questions
  if (!gadQuestions) {
    incomplete.push('gad')
  } else {
    const gadAnswers = [
      gadQuestions.g01,
      gadQuestions.g02,
      gadQuestions.g03,
      gadQuestions.g04,
      gadQuestions.g05,
      gadQuestions.g06,
      gadQuestions.g07,
    ]
    const gadAnswered = gadAnswers.filter((v) => v != null && v !== undefined).length
    if (gadAnswered < GAD_QUESTION_COUNT) incomplete.push('gad')
  }

  return incomplete
}

/**
 * Batched form-completion for the client roster. The per-client helpers above each
 * issue several queries; calling them per row is an N+1 that scales with the roster.
 * This runs ONE findMany per form table (WHERE userId IN (...)) and computes the same
 * results in memory, keyed by userId. Matches the per-client helpers exactly:
 *   - allFormsComplete: WAITLIST -> waitlist forms complete; otherwise prospective
 *     (Application + Physician Statement + ROI) complete.
 *   - incompleteForms: INCOMPLETE -> prospective incomplete; WAITLIST -> waitlist
 *     incomplete; otherwise []. (#95)
 */
export async function getClientFormsStatusBatch(
  prisma: PrismaClient,
  clients: { userId: string; status: ClientStatus }[]
): Promise<Map<string, { allFormsComplete: boolean; incompleteForms: string[] }>> {
  const result = new Map<string, { allFormsComplete: boolean; incompleteForms: string[] }>()
  const userIds = clients.map((c) => c.userId)
  if (userIds.length === 0) return result

  const inUsers = { userId: { in: userIds } }
  const [appForms, physForms, roiForms, aceForms, gadForms, phqForms, pclForms] = await Promise.all(
    [
      prisma.appForm.findMany({
        where: inUsers,
        orderBy: { id: 'desc' },
        select: { userId: true, status: true },
      }),
      prisma.physicianStatementForm.findMany({
        where: inUsers,
        select: { userId: true, status: true },
      }),
      prisma.releaseOfInformationAuthorizationForm.findMany({
        where: inUsers,
        select: { userId: true, status: true },
      }),
      prisma.aceForm.findMany({
        where: inUsers,
        orderBy: { id: 'desc' },
        select: { userId: true, status: true },
      }),
      prisma.gadForm.findMany({
        where: inUsers,
        orderBy: { id: 'desc' },
        select: {
          userId: true,
          questions: {
            select: { g01: true, g02: true, g03: true, g04: true, g05: true, g06: true, g07: true },
          },
        },
      }),
      prisma.phqForm.findMany({
        where: inUsers,
        orderBy: { id: 'desc' },
        select: { userId: true, status: true },
      }),
      prisma.pclForm.findMany({
        where: inUsers,
        orderBy: { id: 'desc' },
        select: { userId: true, status: true },
      }),
    ]
  )

  // Rows arrive newest-first; the first row seen per user is the latest.
  const latestByUser = <T extends { userId: string }>(rows: T[]): Map<string, T> => {
    const map = new Map<string, T>()
    for (const row of rows) if (!map.has(row.userId)) map.set(row.userId, row)
    return map
  }
  const appByUser = latestByUser(appForms)
  const physByUser = latestByUser(physForms)
  const roiByUser = latestByUser(roiForms)
  const aceByUser = latestByUser(aceForms)
  const gadByUser = latestByUser(gadForms)
  const phqByUser = latestByUser(phqForms)
  const pclByUser = latestByUser(pclForms)

  for (const { userId, status } of clients) {
    const prospectiveIncomplete: string[] = []
    if (appByUser.get(userId)?.status !== 'COMPLETE') prospectiveIncomplete.push('application')
    if (physByUser.get(userId)?.status !== 'SUBMITTED')
      prospectiveIncomplete.push('physicianStatement')
    if (roiByUser.get(userId)?.status !== 'SUBMITTED')
      prospectiveIncomplete.push('releaseOfInformationAuthorization')

    const waitlistIncomplete: string[] = []
    if (phqByUser.get(userId)?.status !== 'COMPLETE') waitlistIncomplete.push('phq')
    if (pclByUser.get(userId)?.status !== 'COMPLETE') waitlistIncomplete.push('pcl')
    if (aceByUser.get(userId)?.status !== 'COMPLETE') waitlistIncomplete.push('ace')
    const gadQuestions = gadByUser.get(userId)?.questions
    if (!gadQuestions) {
      waitlistIncomplete.push('gad')
    } else {
      const gadAnswered = [
        gadQuestions.g01,
        gadQuestions.g02,
        gadQuestions.g03,
        gadQuestions.g04,
        gadQuestions.g05,
        gadQuestions.g06,
        gadQuestions.g07,
      ].filter((v) => v != null).length
      if (gadAnswered < GAD_QUESTION_COUNT) waitlistIncomplete.push('gad')
    }

    const isWaitlist = status === 'WAITLIST'
    const allFormsComplete = isWaitlist
      ? waitlistIncomplete.length === 0
      : prospectiveIncomplete.length === 0
    const incompleteForms =
      status === 'INCOMPLETE' ? prospectiveIncomplete : isWaitlist ? waitlistIncomplete : []

    result.set(userId, { allFormsComplete, incompleteForms })
  }

  return result
}

/** Backward-compatible alias: now means prospective completion readiness. */
export async function isAllFormsComplete(prisma: PrismaClient, userId: string): Promise<boolean> {
  return isPreWaitlistComplete(prisma, userId)
}

/** Application, ACE, GAD-7, PHQ-9, and PCL-5 all submitted (single source of truth). */
export async function areAllFormsComplete(prisma: PrismaClient, userId: string): Promise<boolean> {
  const incomplete = await getIncompleteForms(prisma, userId)
  return incomplete.length === 0
}
