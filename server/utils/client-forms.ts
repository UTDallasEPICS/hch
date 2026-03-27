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
  const [aceResponse, gadForm, phqForm, pclForm] = await Promise.all([
    prisma.aceResponse.findFirst({
      where: { userId },
      orderBy: { completedAt: 'desc' },
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

  if (!aceResponse?.responses) {
    incomplete.push('ace')
  } else {
    try {
      const parsed = JSON.parse(aceResponse.responses) as Record<string, unknown>
      const answered = Object.values(parsed).filter(
        (v) => v != null && String(v).trim().length > 0
      ).length
      if (answered < ACE_QUESTION_COUNT) incomplete.push('ace')
    } catch {
      incomplete.push('ace')
    }
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

/** Backward-compatible alias: now means prospective completion readiness. */
export async function isAllFormsComplete(prisma: PrismaClient, userId: string): Promise<boolean> {
  return isPreWaitlistComplete(prisma, userId)
}
