import { requireUser } from '../../../../../utils/guard'
import { assertStaffCanAccessClient } from '../../../../../utils/clinician-access'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { prisma } from '../../../../../utils/prisma'
import { isAdmin } from '../../../../../utils/is-admin'
import {
  backfillClientFormScoreHistoryIfEmpty,
  isScoreHistoryFormKey,
} from '../../../../../utils/form-score-history'

export type FormKeyHistoryEvent = {
  id: string
  score: number | null
  severity: string | null
  recordedAt: string
  questions: { label: string; answer: string }[]
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const clientUserId = getRouterParam(event, 'id')
  const formKey = getRouterParam(event, 'formKey')
  if (!clientUserId || !formKey) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id or form key' })
  }

  if (!isScoreHistoryFormKey(formKey)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'History is only available for ACE, GAD-7, PHQ-9, and PCL-5.',
    })
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, email: true },
  })
  const email = currentUser?.email ?? user.email ?? null
  const isOwnProfile = user.id === clientUserId
  const hasAdminAccess = isAdmin(currentUser?.role ?? null, email)
  const isClinicianViewer = !hasAdminAccess && event.context.isClinician === true
  if (!isOwnProfile && !hasAdminAccess && !isClinicianViewer) {
    throw createError({ statusCode: 403, statusMessage: 'Staff only' })
  }
  if (isClinicianViewer && !isOwnProfile) {
    await assertStaffCanAccessClient(event, clientUserId)
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: clientUserId, role: 'CLIENT' },
  })
  if (!dbUser) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  await backfillClientFormScoreHistoryIfEmpty(prisma, clientUserId)

  const rows = await prisma.clientFormScoreHistory.findMany({
    where: { userId: clientUserId, formKey },
    orderBy: { recordedAt: 'desc' },
  })

  const events: FormKeyHistoryEvent[] = rows.map((r) => {
    let questions: { label: string; answer: string }[] = []
    if (r.answersJson) {
      try {
        const parsed = JSON.parse(r.answersJson) as { questions?: { label: string; answer: string }[] }
        if (Array.isArray(parsed?.questions)) questions = parsed.questions
      } catch {
        questions = []
      }
    }
    return {
      id: r.id,
      score: r.score,
      severity: r.severity,
      recordedAt: r.recordedAt.toISOString(),
      questions,
    }
  })

  return { events }
})
