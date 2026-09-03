import { requireUser } from '../../../utils/guard'
import { createError, defineEventHandler, readBody } from 'h3'
import { loadClinicalFormQuestions } from '../../../utils/clinical-form-display'
import { prisma } from '../../../utils/prisma'
import { calculatePclScore, PCL_QUESTION_KEYS } from '../../../utils/scoring'
import { recordClientFormScoreSubmission } from '../../../utils/form-score-history'

// Keys are zero-padded (q01..q20) to match both the client payload
// (pcl.vue buildPayload) and the PclQuestion columns.
type AnswersBody = {
  q01?: number
  q02?: number
  q03?: number
  q04?: number
  q05?: number
  q06?: number
  q07?: number
  q08?: number
  q09?: number
  q10?: number
  q11?: number
  q12?: number
  q13?: number
  q14?: number
  q15?: number
  q16?: number
  q17?: number
  q18?: number
  q19?: number
  q20?: number
  worstEvent?: string
  // The PCL UI submits through this handler with `isSubmit: true` (mirrors ACE),
  // so save + submit is one atomic request instead of two.
  isSubmit?: boolean
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const userId = user.id
  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  let form = await prisma.pclForm.findFirst({
    where: { userId },
    orderBy: { id: 'desc' },
  })

  if (!form) {
    form = await prisma.pclForm.create({
      data: {
        userId,
        status: 'IN_PROGRESS',
      },
    })
  } else if (form.status === 'COMPLETE') {
    throw createError({
      statusCode: 403,
      statusMessage: 'PCL-5 already submitted',
    })
  }

  let existingQuestions = await prisma.pclQuestion.findUnique({
    where: { formId: form.id },
  })

  if (!existingQuestions) {
    existingQuestions = await prisma.pclQuestion.create({
      data: {
        formId: form.id,
        userId,
      },
    })
  }

  const body = await readBody<AnswersBody>(event)

  const data: Record<string, number | null> = {}
  let answeredCount = 0
  PCL_QUESTION_KEYS.forEach((dbKey) => {
    const value = body?.[dbKey as keyof AnswersBody]
    const numVal = typeof value === 'number' ? value : null
    data[dbKey] = numVal
    if (numVal !== null) answeredCount += 1
  })

  const worstEvent = typeof body?.worstEvent === 'string' ? body.worstEvent : ''
  const isComplete = answeredCount === PCL_QUESTION_KEYS.length && worstEvent.trim().length > 0

  if (body?.isSubmit && !isComplete) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please complete all required questions before submitting',
    })
  }

  await prisma.pclQuestion.update({
    where: { id: existingQuestions.id },
    data: {
      ...data,
      worstEvent: body?.worstEvent ?? null,
    },
  })

  const shouldComplete = Boolean(body?.isSubmit) && isComplete

  // Single source of truth for PCL-5 scoring (#91). Recompute from the persisted
  // answers so the stored score never depends on a prior request.
  const { score: totalScore, severity } = calculatePclScore({ ...data })
  const submittedAt = shouldComplete ? new Date() : null

  await prisma.pclForm.update({
    where: { id: form.id },
    data: {
      totalScore,
      severity,
      ...(shouldComplete ? { status: 'COMPLETE', submittedAt } : {}),
    },
  })

  if (shouldComplete) {
    const historyQuestions = await loadClinicalFormQuestions(prisma, userId, 'pcl')
    await recordClientFormScoreSubmission(prisma, {
      userId,
      formKey: 'pcl',
      score: totalScore,
      severity,
      recordedAt: submittedAt ?? new Date(),
      questions: historyQuestions,
    })
  }

  return shouldComplete ? { submitted: true, totalScore, severity } : { saved: true }
})
