/**
 * Utilities for determining client form completion status.
 * Required forms: Application, ACE, GAD-7, PHQ-9, PCL-5
 */
import type { PrismaClient } from '../../prisma/generated/client'

const ACE_QUESTION_COUNT = 10
const GAD_QUESTION_COUNT = 7

export const FORM_LABELS: Record<string, string> = {
  application: 'Application',
  ace: 'ACE',
  gad: 'GAD-7',
  phq: 'PHQ-9',
  pcl: 'PCL-5',
}

export async function getIncompleteForms(
  prisma: PrismaClient,
  userId: string
): Promise<string[]> {
  const incomplete: string[] = []
  const [appForm, aceResponse, gadForm, phqForm, pclForm] = await Promise.all([
    prisma.appForm.findFirst({
      where: { userId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    }),
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
      include: { questions: true },
    }),
    prisma.pclForm.findFirst({
      where: { userId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    }),
  ])

  if (appForm?.status !== 'COMPLETE') {
    incomplete.push('application')
  }
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

export async function isAllFormsComplete(
  prisma: PrismaClient,
  userId: string
): Promise<boolean> {
  const [appForm, aceResponse, gadForm, phqForm, pclForm] = await Promise.all([
    prisma.appForm.findFirst({
      where: { userId },
      orderBy: { id: 'desc' },
    }),
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

  if (appForm?.status !== 'COMPLETE') return false
  if (phqForm?.status !== 'COMPLETE') return false
  if (pclForm?.status !== 'COMPLETE') return false

  if (!aceResponse?.responses) return false
  try {
    const parsed = JSON.parse(aceResponse.responses) as Record<string, unknown>
    const answered = Object.values(parsed).filter(
      (v) => v != null && String(v).trim().length > 0
    ).length
    if (answered < ACE_QUESTION_COUNT) return false
  } catch {
    return false
  }

  const gadQuestions = gadForm?.questions
  if (!gadQuestions) return false
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
  if (gadAnswered < GAD_QUESTION_COUNT) return false

  return true
}
