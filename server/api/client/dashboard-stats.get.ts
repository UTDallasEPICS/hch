import { createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { formatStoredUserNameForDisplay } from '../../utils/name'
import { prisma } from '../../utils/prisma'
import { isAdmin } from '../../utils/is-admin'

const CLINICAL_STATUS_LABEL: Record<string, string> = {
  INCOMPLETE: 'Pre-waitlist',
  WAITLIST: 'Waitlist',
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
}

const TOTAL_APPLICATION = 50

function hasAnswer(value: string | null | undefined): boolean {
  if (!value) return false
  const trimmed = value.trim()
  if (trimmed.length === 0) return false
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) return parsed.length > 0
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>
      if (Array.isArray(record.values)) {
        const other = typeof record.other === 'string' ? record.other.trim() : ''
        return record.values.length > 0 || other.length > 0
      }
      if ('value' in record || 'text' in record) {
        const selected = typeof record.value === 'string' ? record.value.trim() : ''
        const text = typeof record.text === 'string' ? record.text.trim() : ''
        return selected.length > 0 || text.length > 0
      }
    }
  } catch {
    return trimmed.length > 0
  }
  return trimmed.length > 0
}

async function applicationAnsweredCount(userId: string): Promise<{ answered: number; total: number }> {
  const form = await prisma.appForm.findFirst({
    where: { userId },
    orderBy: { id: 'asc' },
    include: { questions: true },
  })
  const questions = form?.questions
  if (!questions) return { answered: 0, total: TOTAL_APPLICATION }

  let answered = 0
  for (let index = 1; index <= TOTAL_APPLICATION; index += 1) {
    const key = `q${String(index).padStart(2, '0')}` as keyof typeof questions
    const value = questions[key]
    if (typeof value === 'string' && hasAnswer(value)) answered += 1
  }
  return { answered, total: TOTAL_APPLICATION }
}

function welcomeDisplayName(user: { name: string | null; email: string }): string {
  const formatted = formatStoredUserNameForDisplay(user.name ?? '')
  if (formatted) return formatted
  const local = user.email.split('@')[0]?.trim()
  if (local) {
    return local
      .split(/[._-]/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
  }
  return 'there'
}

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, email: true, name: true },
  })
  if (!user?.email) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (isAdmin(user.role ?? null, user.email)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const displayName = welcomeDisplayName(user)

  const client = await prisma.client.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true, therapyWeek: true },
  })

  if (!client) {
    return {
      displayName,
      statusLabel: 'Not enrolled',
      therapyWeekDisplay: '—',
      formsProgressDisplay: '—',
      pendingSessionNotesRequests: 0,
    }
  }

  const statusLabel = CLINICAL_STATUS_LABEL[client.status] ?? client.status

  const therapyWeekDisplay =
    client.status === 'ACTIVE' && client.therapyWeek != null
      ? `${client.therapyWeek} / 26`
      : '—'

  let formsProgressDisplay = '—'
  if (client.status === 'INCOMPLETE' || client.status === 'WAITLIST') {
    const { answered, total } = await applicationAnsweredCount(session.user.id)
    formsProgressDisplay = `${answered}/${total}`
  } else if (client.status === 'ACTIVE') {
    const userId = session.user.id
    const aceForm = await prisma.form.findUnique({ where: { slug: 'ace-form' } })
    const assignment = aceForm
      ? await prisma.formAssignment.findUnique({
          where: { userId_formId: { userId, formId: aceForm.id } },
        })
      : null
    const aceSubmitted = assignment?.completedAt != null

    const [gadForm, phqForm, pclForm] = await Promise.all([
      prisma.gadForm.findFirst({ where: { userId }, orderBy: { id: 'desc' } }),
      prisma.phqForm.findUnique({ where: { userId } }),
      prisma.pclForm.findFirst({ where: { userId }, orderBy: { id: 'desc' } }),
    ])

    const gadSubmitted = gadForm?.status === 'COMPLETE'
    const phqSubmitted = phqForm?.status === 'COMPLETE'
    const pclSubmitted = pclForm?.status === 'COMPLETE'

    const n = [aceSubmitted, gadSubmitted, phqSubmitted, pclSubmitted].filter(Boolean).length
    formsProgressDisplay = `${n}/4`
  }

  const pendingSessionNotesRequests = await prisma.sessionNotesRequest.count({
    where: { clientId: client.id, status: 'PENDING' },
  })

  return {
    displayName,
    statusLabel,
    therapyWeekDisplay,
    formsProgressDisplay,
    pendingSessionNotesRequests,
  }
})
