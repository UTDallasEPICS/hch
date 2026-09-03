import { requireUser } from '../../../utils/guard'
import { createError, defineEventHandler, readBody } from 'h3'
import { loadClinicalFormQuestions } from '../../../utils/clinical-form-display'
import { prisma } from '../../../utils/prisma'
import { calculateGadScore } from '../../../utils/scoring'
import { recordClientFormScoreSubmission } from '../../../utils/form-score-history'

type GadBody = {
  g1?: number | string | null
  g2?: number | string | null
  g3?: number | string | null
  g4?: number | string | null
  g5?: number | string | null
  g6?: number | string | null
  g7?: number | string | null
  g8?: number | string | null
  // The GAD UI submits through this handler with `isSubmit: true` (mirrors ACE),
  // so save + submit is one atomic request instead of two.
  isSubmit?: boolean
}

function toNullableInt(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const userId = user.id

  const body = await readBody<GadBody>(event)

  // find or create form
  let form = await prisma.gadForm.findFirst({
    where: { userId },
    orderBy: { id: 'desc' },
  })

  if (!form) {
    form = await prisma.gadForm.create({
      data: { userId },
    })
  }

  //find or create questions row
  let questions = await prisma.gadQuestion.findFirst({
    where: { formId: form.id },
  })

  if (!questions) {
    questions = await prisma.gadQuestion.create({
      data: {
        formId: form.id,
        userId,
      },
    })
  }

  const answerData = {
    g01: toNullableInt(body.g1),
    g02: toNullableInt(body.g2),
    g03: toNullableInt(body.g3),
    g04: toNullableInt(body.g4),
    g05: toNullableInt(body.g5),
    g06: toNullableInt(body.g6),
    g07: toNullableInt(body.g7),
    g08: toNullableInt(body.g8),
  }

  // Single source of truth for GAD-7 scoring (#91).
  const { score: totalScore, severity } = calculateGadScore(answerData)

  // GAD-7 total is items g01–g07; g08 is the functional-difficulty item.
  const allMainAnswered = [
    answerData.g01,
    answerData.g02,
    answerData.g03,
    answerData.g04,
    answerData.g05,
    answerData.g06,
    answerData.g07,
  ].every((v) => v !== null)

  if (body.isSubmit && !allMainAnswered) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please complete all required questions before submitting',
    })
  }

  const wasAlreadyComplete = form.status === 'COMPLETE'
  const shouldComplete = Boolean(body.isSubmit) && allMainAnswered
  const submittedAt = shouldComplete ? new Date() : form.submittedAt

  // save answers
  await prisma.gadQuestion.update({
    where: { id: questions.id },
    data: answerData,
  })

  // save score (and complete the form when submitting)
  await prisma.gadForm.update({
    where: { id: form.id },
    data: {
      totalScore,
      severity,
      ...(shouldComplete ? { status: 'COMPLETE', submittedAt } : {}),
    },
  })

  if (shouldComplete && !wasAlreadyComplete) {
    const historyQuestions = await loadClinicalFormQuestions(prisma, userId, 'gad')
    await recordClientFormScoreSubmission(prisma, {
      userId,
      formKey: 'gad',
      score: totalScore,
      severity,
      recordedAt: submittedAt ?? new Date(),
      questions: historyQuestions,
    })
  }

  return shouldComplete ? { submitted: true } : { saved: true }
})
