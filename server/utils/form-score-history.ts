import type { PrismaClient } from '../../prisma/generated/client'
import { loadClinicalFormQuestions } from './clinical-form-display'
import { FORM_LABELS } from './client-forms'
import { calculatePhqScore } from './scoring'

export const SCORE_HISTORY_FORM_KEYS = ['ace', 'gad', 'phq', 'pcl'] as const
export type ScoreHistoryFormKey = (typeof SCORE_HISTORY_FORM_KEYS)[number]

const KEY_SET = new Set<string>(SCORE_HISTORY_FORM_KEYS)

export function isScoreHistoryFormKey(k: string): k is ScoreHistoryFormKey {
  return KEY_SET.has(k)
}

export async function recordClientFormScoreSubmission(
  db: PrismaClient,
  params: {
    userId: string
    formKey: ScoreHistoryFormKey
    score: number | null
    severity: string | null
    recordedAt?: Date
    /** Snapshot of Q&A at submit time (same shape as form GET `questions`). */
    questions?: { label: string; answer: string }[]
  }
): Promise<void> {
  const answersJson =
    params.questions && params.questions.length > 0
      ? JSON.stringify({ questions: params.questions })
      : null
  await db.clientFormScoreHistory.create({
    data: {
      userId: params.userId,
      formKey: params.formKey,
      score: params.score,
      severity: params.severity,
      recordedAt: params.recordedAt ?? new Date(),
      answersJson,
    },
  })
}

/** One-time backfill from current form rows when the history table is empty (existing installs). */
export async function backfillClientFormScoreHistoryIfEmpty(
  db: PrismaClient,
  userId: string
): Promise<void> {
  const existing = await db.clientFormScoreHistory.count({ where: { userId } })
  if (existing > 0) return

  const [aceForm, gadForm, phqForm, pclForm] = await Promise.all([
    db.aceForm.findFirst({ where: { userId }, orderBy: { id: 'desc' } }),
    db.gadForm.findFirst({ where: { userId }, orderBy: { id: 'desc' } }),
    db.phqForm.findFirst({
      where: { userId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    }),
    db.pclForm.findFirst({ where: { userId }, orderBy: { id: 'desc' } }),
  ])

  const entries: {
    formKey: ScoreHistoryFormKey
    score: number | null
    severity: string | null
    recordedAt: Date
  }[] = []

  if (aceForm?.status === 'COMPLETE' && aceForm.submittedAt) {
    entries.push({
      formKey: 'ace',
      score: aceForm.totalScore ?? null,
      severity: aceForm.severity ?? null,
      recordedAt: aceForm.submittedAt,
    })
  }
  if (gadForm?.status === 'COMPLETE' && gadForm.submittedAt) {
    entries.push({
      formKey: 'gad',
      score: gadForm.totalScore ?? null,
      severity: gadForm.severity ?? null,
      recordedAt: gadForm.submittedAt,
    })
  }
  if (phqForm?.status === 'COMPLETE' && phqForm.submittedAt) {
    const phqSev = phqForm.questions
      ? calculatePhqScore(phqForm.questions as Record<string, unknown>).severity
      : null
    entries.push({
      formKey: 'phq',
      score: phqForm.totalScore ?? null,
      severity: phqSev,
      recordedAt: phqForm.submittedAt,
    })
  }
  if (pclForm?.status === 'COMPLETE' && pclForm.submittedAt) {
    entries.push({
      formKey: 'pcl',
      score: pclForm.totalScore ?? null,
      severity: pclForm.severity ?? null,
      recordedAt: pclForm.submittedAt,
    })
  }

  for (const e of entries) {
    const questions = await loadClinicalFormQuestions(db, userId, e.formKey)
    const answersJson =
      questions.length > 0 ? JSON.stringify({ questions }) : null
    await db.clientFormScoreHistory.create({
      data: {
        userId,
        formKey: e.formKey,
        score: e.score,
        severity: e.severity,
        recordedAt: e.recordedAt,
        answersJson,
      },
    })
  }
}

export function formLabelForHistoryKey(formKey: string): string {
  return FORM_LABELS[formKey] ?? formKey
}
