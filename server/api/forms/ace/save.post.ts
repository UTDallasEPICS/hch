import { requireUser } from '../../../utils/guard'
import { createError, defineEventHandler, getHeaders, readBody } from 'h3'
import { loadClinicalFormQuestions } from '../../../utils/clinical-form-display'
import { recordClientFormScoreSubmission } from '../../../utils/form-score-history'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {

  const user = requireUser(event)
  
  const userId = user.id

  const body = await readBody(event)
  if (!body) {
    throw createError({ statusCode: 400, statusMessage: 'Missing body' })
  }

  let form = await prisma.aceForm.findUnique({
    where: { userId },
    include: { questions: true },
  })

  if (!form) {
    form = await prisma.aceForm.create({
      data: {
        userId,
        status: 'IN_PROGRESS',
        questions: { create: { userId } }
      },
      include: { questions: true }
    })
  } else if (!form.questions) {
    const questions = await prisma.aceQuestion.create({
      data: { formId: form.id, userId }
    })
    form.questions = questions
  }

  const questionsId = form.questions!.id

  const dataToUpdate: any = {}
  const keys = ['a01', 'a02', 'a03', 'a04', 'a05', 'a06', 'a07', 'a08', 'a09', 'a10']
  let answeredCount = 0

  for (const k of keys) {
    if (body[k] !== undefined) {
      dataToUpdate[k] = body[k] === null ? null : String(body[k])
      if (dataToUpdate[k] !== null && dataToUpdate[k] !== '') {
        answeredCount++
      }
    }
  }

  await prisma.aceQuestion.update({
    where: { id: questionsId },
    data: dataToUpdate,
  })

  /** ACE UI submits via this save handler with `isSubmit: true`, not `/api/forms/ace/submit`. */
  const wasAlreadyComplete = form.status === 'COMPLETE'

  let status = form.status
  let submittedAt = form.submittedAt
  let totalScore = form.totalScore
  let severity = form.severity

  if (body.isSubmit && answeredCount === 10) {
    status = 'COMPLETE'
    submittedAt = new Date()

    // Calculate score
    const allAnswers = { ...form.questions, ...dataToUpdate }
    let score = 0
    for (const k of keys) {
      if (allAnswers[k] === 'Yes') {
        score++
      }
    }
    totalScore = score

    if (score === 0) severity = 'No reported ACEs'
    else if (score <= 3) severity = 'Intermediate risk'
    else severity = 'High risk'
  }

  await prisma.aceForm.update({
    where: { id: form.id },
    data: {
      status,
      submittedAt,
      totalScore,
      severity
    }
  })

  if (
    body.isSubmit &&
    answeredCount === 10 &&
    !wasAlreadyComplete &&
    status === 'COMPLETE'
  ) {
    const questions = await loadClinicalFormQuestions(prisma, userId, 'ace')
    await recordClientFormScoreSubmission(prisma, {
      userId,
      formKey: 'ace',
      score: totalScore ?? null,
      severity: severity ?? null,
      recordedAt: submittedAt ?? new Date(),
      questions,
    })
  }

  return { success: true }
})
