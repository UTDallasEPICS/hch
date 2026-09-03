import { requireUser } from '../../../utils/guard'
import { createError, defineEventHandler } from 'h3'
import { loadClinicalFormQuestions } from '../../../utils/clinical-form-display'
import { prisma } from '../../../utils/prisma'
import { calculatePclScore, PCL_QUESTION_KEYS } from '../../../utils/scoring'
import { recordClientFormScoreSubmission } from '../../../utils/form-score-history'

const TOTAL_ITEMS = 21

export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const userId = user.id

  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const form = await prisma.pclForm.findFirst({
    where: {
      userId,
    },
    orderBy: {
      id: 'asc',
    },
    include: {
      questions: true,
    },
  })

  if (!form || !form.questions) {
    throw createError({
      statusCode: 400,
      statusMessage: 'PCL-5 form not started',
    })
  }

  if (form.status === 'COMPLETE') {
    return {
      submitted: true,
    }
  }

  let answered = 0
  for (const key of PCL_QUESTION_KEYS) {
    const value = form.questions[key as keyof typeof form.questions]

    if (typeof value === 'number') {
      answered += 1
    }
  }

  if (
    typeof form.questions.worstEvent === 'string' &&
    form.questions.worstEvent.trim().length > 0
  ) {
    answered += 1
  }

  if (answered !== TOTAL_ITEMS) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please complete all required questions before submitting',
    })
  }

  const { score: totalScore, severity } = calculatePclScore(form.questions)

  const submittedAt = new Date()
  await prisma.pclForm.update({
    where: {
      id: form.id,
    },
    data: {
      status: 'COMPLETE',
      totalScore,
      severity,
      submittedAt,
    },
  })

  const questions = await loadClinicalFormQuestions(prisma, userId, 'pcl')
  await recordClientFormScoreSubmission(prisma, {
    userId,
    formKey: 'pcl',
    score: totalScore,
    severity,
    recordedAt: submittedAt,
    questions,
  })

  return {
    submitted: true,
    totalScore,
    severity,
  }
})
