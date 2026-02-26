import { createError, defineEventHandler, getHeaders, getRouterParam } from 'h3'
import { auth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import {
  isAllFormsComplete,
  getIncompleteForms,
  FORM_LABELS,
} from '../../../utils/client-forms'
import { parseName } from '../../../utils/name'
import { getAceFormQuestions } from '../../../utils/ace-questions'
import type { ClientStatus } from '../../../../../prisma/generated/client'

const APP_TOTAL = 50
const GAD_TOTAL = 7
const PHQ_TOTAL = 10
const PCL_TOTAL = 20
const ACE_QUESTION_COUNT = 10

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const clientUserId = getRouterParam(event, 'id')
  if (!clientUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  // Allow admin to view any client, or client to view their own (limited)
  const isOwnProfile = session.user.id === clientUserId
  const isAdmin = session.user.role === 'ADMIN'
  if (!isOwnProfile && !isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const user = await prisma.user.findFirst({
    where: { id: clientUserId, role: 'CLIENT' },
    include: {
      client: {
        include: {
          permissions: true,
          sessionNotes: { orderBy: { createdAt: 'desc' } },
          plan: true,
        },
      },
    },
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  const clientProfile = user.client
  const { fname, lname } = parseName(user.name)

  // Fetch form progress (what client sees on tasks page)
  const [appForm, aceResponse, gadForm, phqForm, pclForm] = await Promise.all([
    prisma.appForm.findFirst({
      where: { userId: clientUserId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    }),
    prisma.aceResponse.findFirst({
      where: { userId: clientUserId },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.gadForm.findFirst({
      where: { userId: clientUserId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    }),
    prisma.phqForm.findFirst({
      where: { userId: clientUserId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    }),
    prisma.pclForm.findFirst({
      where: { userId: clientUserId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    }),
  ])

  // Application progress
  let appAnswered = 0
  const appQuestions = appForm?.questions
  if (appQuestions) {
    for (let i = 1; i <= APP_TOTAL; i++) {
      const key = `q${String(i).padStart(2, '0')}` as keyof typeof appQuestions
      const val = appQuestions[key]
      if (typeof val === 'string' && val?.trim().length > 0) appAnswered++
    }
  }

  // ACE progress
  const aceQuestions = getAceFormQuestions()
  const aceResponses = aceResponse
    ? (JSON.parse(aceResponse.responses) as Record<string, string>)
    : {}
  const aceAnswered = aceQuestions.filter(
    (q) =>
      aceResponses[q.alias] !== undefined &&
      String(aceResponses[q.alias]).trim().length > 0
  ).length
  const aceForm = await prisma.form.findUnique({ where: { slug: 'ace-form' } })
  const aceAssignment = aceForm
    ? await prisma.formAssignment.findUnique({
        where: { userId_formId: { userId: clientUserId, formId: aceForm.id } },
      })
    : null
  const aceSubmitted = aceAssignment?.completedAt != null

  // GAD progress & score
  const gadQuestions = gadForm?.questions
  let gadAnswered = 0
  if (gadQuestions) {
    const answers = [
      gadQuestions.g01,
      gadQuestions.g02,
      gadQuestions.g03,
      gadQuestions.g04,
      gadQuestions.g05,
      gadQuestions.g06,
      gadQuestions.g07,
    ]
    gadAnswered = answers.filter((v) => v != null && v !== undefined).length
  }

  // PHQ progress & score
  const phqQuestions = phqForm?.questions
  let phqAnswered = 0
  if (phqQuestions) {
    for (let i = 1; i <= PHQ_TOTAL; i++) {
      const key = `q${i}` as keyof typeof phqQuestions
      const v = phqQuestions[key]
      if (typeof v === 'number' && v >= 0) phqAnswered++
    }
  }

  // PCL progress
  const pclQuestions = pclForm?.questions
  let pclAnswered = 0
  if (pclQuestions) {
    for (let i = 1; i <= PCL_TOTAL; i++) {
      const key = `q${String(i).padStart(2, '0')}` as keyof typeof pclQuestions
      const v = pclQuestions[key]
      if (typeof v === 'number' && v >= 0) pclAnswered++
    }
  }

  const allFormsComplete = await isAllFormsComplete(prisma, clientUserId)
  const incompleteForms = await getIncompleteForms(prisma, clientUserId)

  const tasks = [
    {
      key: 'application',
      name: FORM_LABELS.application,
      to: '/application',
      answered: appAnswered,
      total: APP_TOTAL,
      submitted: appForm?.status === 'COMPLETE',
    },
    {
      key: 'ace',
      name: 'ACE',
      to: aceSubmitted ? '/forms/ace-form-results' : '/forms/ace-form',
      answered: aceAnswered,
      total: aceQuestions.length,
      submitted: aceSubmitted,
    },
    {
      key: 'gad',
      name: 'GAD-7',
      to: '/gad',
      answered: gadAnswered,
      total: GAD_TOTAL,
      submitted: gadForm?.status === 'COMPLETE',
      score: gadForm?.totalScore ?? null,
      severity: gadForm?.severity ?? null,
    },
    {
      key: 'phq',
      name: 'PHQ-9',
      to: '/phq',
      answered: phqAnswered,
      total: PHQ_TOTAL,
      submitted: phqForm?.status === 'COMPLETE',
      score: phqForm?.totalScore ?? null,
    },
    {
      key: 'pcl',
      name: 'PCL-5',
      to: '/pcl',
      answered: pclAnswered,
      total: PCL_TOTAL,
      submitted: pclForm?.status === 'COMPLETE',
    },
  ]

  const metrics = tasks
    .filter((t) => t.submitted && (t.score != null || t.severity != null))
    .map((t) => ({
      form: t.name,
      score: t.score,
      severity: t.severity,
    }))

  return {
    id: user.id,
    fname,
    lname,
    name: user.name,
    email: user.email,
    status: (clientProfile?.status ?? 'INCOMPLETE') as ClientStatus,
    therapyWeek: clientProfile?.therapyWeek ?? null,
    missedSessions: clientProfile?.missedSessions ?? 0,
    allFormsComplete,
    incompleteForms,
    tasks,
    metrics,
    permissions: clientProfile?.permissions
      ? {
          canViewScores: clientProfile.permissions.canViewScores,
          canViewNotes: clientProfile.permissions.canViewNotes,
          canViewPlan: clientProfile.permissions.canViewPlan,
        }
      : { canViewScores: false, canViewNotes: false, canViewPlan: false },
    sessionNotes: isAdmin ? (clientProfile?.sessionNotes ?? []) : [],
    plan: isAdmin ? clientProfile?.plan : null,
  }
})
