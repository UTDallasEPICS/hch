import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requireUser } from '../../../../utils/guard'
import { prisma } from '../../../../utils/prisma'
import {
  recordClientFormScoreSubmission,
  isScoreHistoryFormKey,
} from '../../../../utils/form-score-history'
import { loadClinicalFormQuestions } from '../../../../utils/clinical-form-display'
import { isAdmin } from '../../../../utils/is-admin'
import { assertStaffCanAccessClient } from '../../../../utils/clinician-access'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const clientUserId = getRouterParam(event, 'id')
  const formKey = getRouterParam(event, 'formKey')

  if (!clientUserId || !formKey) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id or form key' })
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, email: true },
  })
  if (!isAdmin(currentUser?.role ?? null, currentUser?.email ?? null)) {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }

  // Enforce clinic scope on the client, matching the sibling PATCH route (#89).
  await assertStaffCanAccessClient(event, clientUserId)

  if (!isScoreHistoryFormKey(formKey)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid form key' })
  }

  const questions = await loadClinicalFormQuestions(
    prisma,
    clientUserId,
    formKey as 'ace' | 'gad' | 'phq' | 'pcl'
  )

  let score: number | null = null
  let severity: string | null = null

  if (formKey === 'ace') {
    const f = await prisma.aceForm.findFirst({
      where: { userId: clientUserId },
      orderBy: { id: 'desc' },
    })
    score = f?.totalScore ?? null
    severity = f?.severity ?? null
  } else if (formKey === 'gad') {
    const f = await prisma.gadForm.findFirst({
      where: { userId: clientUserId },
      orderBy: { id: 'desc' },
    })
    score = f?.totalScore ?? null
    severity = f?.severity ?? null
  } else if (formKey === 'phq') {
    const f = await prisma.phqForm.findFirst({
      where: { userId: clientUserId },
      orderBy: { id: 'desc' },
    })
    score = f?.totalScore ?? null
    severity = f?.severity ?? null
  } else if (formKey === 'pcl') {
    const f = await prisma.pclForm.findFirst({
      where: { userId: clientUserId },
      orderBy: { id: 'desc' },
    })
    score = f?.totalScore ?? null
    severity = f?.severity ?? null
  }

  await recordClientFormScoreSubmission(prisma, {
    userId: clientUserId,
    formKey,
    score,
    severity,
    recordedAt: new Date(),
    questions,
  })

  if (formKey === 'ace') {
    const form = await prisma.aceForm.create({
      data: { userId: clientUserId, status: 'IN_PROGRESS' },
    })
    await prisma.aceQuestion.create({ data: { formId: form.id, userId: clientUserId } })
    return { ok: true, formId: form.id }
  }
  if (formKey === 'gad') {
    const form = await prisma.gadForm.create({
      data: { userId: clientUserId, status: 'IN_PROGRESS' },
    })
    await prisma.gadQuestion.create({ data: { formId: form.id, userId: clientUserId } })
    return { ok: true, formId: form.id }
  }
  if (formKey === 'phq') {
    const form = await prisma.phqForm.create({
      data: { userId: clientUserId, status: 'IN_PROGRESS' },
    })
    await prisma.phqQuestion.create({ data: { formId: form.id, userId: clientUserId } })
    return { ok: true, formId: form.id }
  }
  if (formKey === 'pcl') {
    const form = await prisma.pclForm.create({
      data: { userId: clientUserId, status: 'IN_PROGRESS' },
    })
    await prisma.pclQuestion.create({ data: { formId: form.id, userId: clientUserId } })
    return { ok: true, formId: form.id }
  }

  throw createError({ statusCode: 400, statusMessage: 'Invalid form key' })
})
