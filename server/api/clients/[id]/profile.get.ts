import { requireUser } from '../../../utils/guard'
import { createError, defineEventHandler, getHeaders, getRouterParam } from 'h3'
import { prisma } from '../../../utils/prisma'
import { isAdmin } from '../../../utils/is-admin'
import { isClinicalClient } from '../../../utils/is-clinical-client'
import { getIncompleteForms, FORM_LABELS } from '../../../utils/client-forms'
import { parseName } from '../../../utils/name'
import type { ClientStatus } from '../../../../prisma/generated/client'
import { ensureDefaultDeclarationTemplates } from '../../../utils/declaration-templates'
import { calculateAceScore, calculatePhqScore, calculatePclScore } from '../../../utils/scoring'

const APP_TOTAL = 50
const GAD_TOTAL = 7
const PHQ_TOTAL = 10
const PCL_TOTAL = 20
const ACE_QUESTION_COUNT = 10

export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  await ensureDefaultDeclarationTemplates(prisma)

  const clientUserId = getRouterParam(event, 'id')
  if (!clientUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  // Allow admin to view any client, or client to view their own (limited)
  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, email: true },
  })
  const isOwnProfile = user.id === clientUserId
  const hasAdminAccess = isAdmin(currentUser?.role ?? null, currentUser?.email ?? null)
  if (!isOwnProfile && !hasAdminAccess) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: clientUserId, role: 'CLIENT' },
    include: {
      client: {
        include: {
          permissions: true,
          sessionNotesRequests: {
            orderBy: { createdAt: 'desc' },
            include: { declarationTemplate: true },
          },
          plan: true,
        },
      },
    },
  })

  if (!dbUser) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  if (!isClinicalClient(dbUser.role, dbUser.email)) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  const clientProfile = dbUser.client
  const resolvedClientRowId =
    clientProfile?.id ??
    (
      await prisma.client.findUnique({
        where: { userId: clientUserId },
        select: { id: true },
      })
    )?.id
  const { fname, lname } = parseName(dbUser.name)

  // Fetch form progress (what client sees on tasks page)
  const [appForm, physicianStatementForm, roiForm, aceForm, gadForm, phqForm, pclForm] =
    await Promise.all([
      prisma.appForm.findFirst({
        where: { userId: clientUserId },
        orderBy: { id: 'desc' },
        include: { questions: true },
      }),
      prisma.physicianStatementForm.findUnique({
        where: { userId: clientUserId },
        select: { status: true },
      }),
      prisma.releaseOfInformationAuthorizationForm.findUnique({
        where: { userId: clientUserId },
        select: { status: true },
      }),
      prisma.aceForm.findFirst({
        where: { userId: clientUserId },
        orderBy: { id: 'desc' },
        include: { questions: true },
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
  const aceQuestionsDb = aceForm?.questions
  let aceAnswered = 0
  if (aceQuestionsDb) {
    const answers = [
      aceQuestionsDb.a01,
      aceQuestionsDb.a02,
      aceQuestionsDb.a03,
      aceQuestionsDb.a04,
      aceQuestionsDb.a05,
      aceQuestionsDb.a06,
      aceQuestionsDb.a07,
      aceQuestionsDb.a08,
      aceQuestionsDb.a09,
      aceQuestionsDb.a10,
    ]
    aceAnswered = answers.filter((v) => v != null && v !== undefined).length
  }
  const aceSubmitted = aceForm?.status === 'COMPLETE'

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

  const incompleteForms = await getIncompleteForms(prisma, clientUserId)
  const allFormsComplete = incompleteForms.length === 0

  // ACE score: count of "Yes" answers; severity per interpretation breakdown
  let aceScore = aceForm?.totalScore ?? null
  let aceSeverity = aceForm?.severity ?? null
  if (aceScore == null && aceQuestionsDb) {
    const calculated = calculateAceScore(aceQuestionsDb)
    aceScore = calculated.score
    aceSeverity = calculated.severity
  }

  // PHQ totalScore: compute from questions if not stored (backward compat)
  let phqScore = phqForm?.totalScore ?? null
  let phqSeverity = phqForm?.severity ?? null
  if (phqScore == null && phqQuestions) {
    const calculated = calculatePhqScore(phqQuestions)
    phqScore = calculated.score
    phqSeverity = calculated.severity
  }

  // PCL totalScore: compute from questions if not stored (backward compat)
  let pclScore = pclForm?.totalScore ?? null
  let pclSeverity = pclForm?.severity ?? null
  if (pclScore == null && pclQuestions) {
    const calculated = calculatePclScore(pclQuestions)
    pclScore = calculated.score
    pclSeverity = calculated.severity
  }

  const physicianStatementSubmitted = physicianStatementForm?.status === 'SUBMITTED'
  const roiSubmitted = roiForm?.status === 'SUBMITTED'

  const tasks = [
    {
      key: 'application',
      name: FORM_LABELS.application,
      to: '/forms/application',
      answered: appAnswered,
      total: APP_TOTAL,
      submitted: appForm?.status === 'COMPLETE',
    },
    {
      key: 'physicianStatement',
      name: FORM_LABELS.physicianStatement,
      to: '/forms/physician-statement',
      answered: physicianStatementSubmitted ? 1 : 0,
      total: 1,
      submitted: physicianStatementSubmitted,
    },
    {
      key: 'releaseOfInformationAuthorization',
      name: FORM_LABELS.releaseOfInformationAuthorization,
      to: '/forms/release-of-information-authorization',
      answered: roiSubmitted ? 1 : 0,
      total: 1,
      submitted: roiSubmitted,
    },
    {
      key: 'ace',
      name: 'ACE',
      to: aceSubmitted ? '/forms/ace-form-results' : '/forms/ace-form',
      answered: aceAnswered,
      total: 10,
      submitted: aceSubmitted,
      score: aceScore,
      severity: aceSeverity,
    },
    {
      key: 'gad',
      name: 'GAD-7',
      to: '/forms/gad',
      answered: gadAnswered,
      total: GAD_TOTAL,
      submitted: gadForm?.status === 'COMPLETE',
      score: gadForm?.totalScore ?? null,
      severity: gadForm?.severity ?? null,
    },
    {
      key: 'phq',
      name: 'PHQ-9',
      to: '/forms/phq',
      answered: phqAnswered,
      total: PHQ_TOTAL,
      submitted: phqForm?.status === 'COMPLETE',
      score: phqScore,
      severity: phqSeverity,
    },
    {
      key: 'pcl',
      name: 'PCL-5',
      to: '/forms/pcl',
      answered: pclAnswered,
      total: PCL_TOTAL,
      submitted: pclForm?.status === 'COMPLETE',
      score: pclScore,
      severity: pclSeverity,
    },
  ]

  const requests = clientProfile?.sessionNotesRequests ?? []
  const latestApproved = [...requests]
    .filter((r) => r.status === 'APPROVED' && r.decidedAt)
    .sort((a, b) => b.decidedAt!.getTime() - a.decidedAt!.getTime())[0]

  const legacyNotes = Boolean(clientProfile?.permissions?.canViewNotes)
  const hasPendingRequest = requests.some((r) => r.status === 'PENDING')

  let sessionNotesAccess: {
    hasAccess: boolean
    mode: 'full' | 'summary' | null
    summaryText: string | null
    hasPendingRequest: boolean
  } = {
    hasAccess: false,
    mode: null,
    summaryText: null,
    hasPendingRequest: hasPendingRequest,
  }

  if (hasAdminAccess || (isOwnProfile && legacyNotes)) {
    sessionNotesAccess = {
      hasAccess: true,
      mode: 'full',
      summaryText: null,
      hasPendingRequest: hasPendingRequest,
    }
  } else if (isOwnProfile && latestApproved) {
    if (latestApproved.requestKind === 'FULL') {
      sessionNotesAccess = {
        hasAccess: true,
        mode: 'full',
        summaryText: null,
        hasPendingRequest: hasPendingRequest,
      }
    } else {
      sessionNotesAccess = {
        hasAccess: true,
        mode: 'summary',
        summaryText: latestApproved.approvedSummaryText ?? null,
        hasPendingRequest: hasPendingRequest,
      }
    }
  }

  const showRawSessionNotes =
    hasAdminAccess ||
    (isOwnProfile && legacyNotes) ||
    (isOwnProfile && latestApproved?.status === 'APPROVED' && latestApproved.requestKind === 'FULL')

  const sessionNotesRequestsPayload = requests.map((r) => ({
    id: r.id,
    requestKind: r.requestKind,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    declarationText: r.declarationTemplate.content,
    declarationTemplateId: r.declarationTemplateId,
    declarationVersion: r.declarationTemplate.version,
    signatureData: r.signatureData,
    rejectionReason: r.rejectionReason,
    approvedSummaryText: r.approvedSummaryText,
  }))

  const canViewScores =
    hasAdminAccess || (isOwnProfile && clientProfile?.permissions?.canViewScores)
  const metrics = canViewScores
    ? tasks
        .filter((t) => t.submitted && (t.score != null || t.severity != null))
        .map((t) => ({ form: t.name, score: t.score, severity: t.severity }))
    : []

  const tasksForClient =
    isOwnProfile && !canViewScores ? tasks.map(({ score: _s, severity: _v, ...t }) => t) : tasks

  // Session notes: always scoped by canonical Client.id
  let sessionNotesPayload: {
    id: string
    content: string
    createdAt: string
    sessionName: string
    sessionNumber: number
    appointmentId: string | null
  }[] = []
  if (showRawSessionNotes && resolvedClientRowId) {
    let sessionRows: {
      id: string
      content: string
      createdAt: Date
      sessionName: string
      sessionNumber: number
      appointmentId: string | null
    }[] = []
    try {
      sessionRows = await prisma.sessionNote.findMany({
        where: { clientId: resolvedClientRowId },
        orderBy: { createdAt: 'desc' },
      })
    } catch {
      sessionRows = []
    }
    const fromSession = sessionRows.map((s) => ({
      id: s.id,
      content: s.content,
      createdAt: s.createdAt.toISOString(),
      sessionName: s.sessionName,
      sessionNumber: s.sessionNumber,
      appointmentId: s.appointmentId,
    }))
    sessionNotesPayload = fromSession
  }

  const appointments = resolvedClientRowId
    ? await prisma.appointment.findMany({
        where: { clientId: clientUserId },
        orderBy: [{ startTime: 'desc' }],
        select: {
          id: true,
          sessionName: true,
          sessionNumber: true,
          startTime: true,
          status: true,
        },
      })
    : []

  return {
    id: dbUser.id,
    fname,
    lname,
    name: dbUser.name,
    email: dbUser.email,
    status: (clientProfile?.status ?? 'INCOMPLETE') as ClientStatus,
    therapyWeek: clientProfile?.therapyWeek ?? null,
    missedSessions: clientProfile?.missedSessions ?? 0,
    allFormsComplete,
    incompleteForms,
    tasks: tasksForClient,
    metrics,
    permissions: clientProfile?.permissions
      ? {
          canViewScores: clientProfile.permissions.canViewScores,
          canViewNotes: clientProfile.permissions.canViewNotes,
          canViewPlan: clientProfile.permissions.canViewPlan,
        }
      : { canViewScores: false, canViewNotes: false, canViewPlan: false },
    sessionNotesAccess,
    sessionNotesRequests: sessionNotesRequestsPayload,
    sessionNotes: sessionNotesPayload,
    appointments: appointments.map((a) => ({
      id: a.id,
      sessionName: a.sessionName,
      sessionNumber: a.sessionNumber,
      startTime: a.startTime.toISOString(),
      status: a.status,
    })),
    plan:
      hasAdminAccess || (isOwnProfile && clientProfile?.permissions?.canViewPlan)
        ? clientProfile?.plan
        : null,
  }
})
