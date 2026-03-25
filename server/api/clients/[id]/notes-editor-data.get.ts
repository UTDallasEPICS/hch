import { createError, defineEventHandler, getHeaders, getRouterParam } from 'h3'
import { auth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { isAdmin } from '../../../utils/is-admin'
import { getIncompleteForms, FORM_LABELS } from '../../../utils/client-forms'
import { formatStoredUserNameForDisplay, parseName } from '../../../utils/name'

const FORM_ORDER = ['application', 'ace', 'gad', 'phq', 'pcl'] as const

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, email: true },
  })
  if (!isAdmin(currentUser?.role ?? null, currentUser?.email ?? null)) {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }

  const clientUserId = getRouterParam(event, 'id')
  if (!clientUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  const user = await prisma.user.findFirst({
    where: { id: clientUserId, role: 'CLIENT' },
    include: { client: true },
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  let clientRow = user.client
  if (!clientRow) {
    clientRow = await prisma.client.create({
      data: { userId: clientUserId },
    })
  }

  const resolvedClientRowId = clientRow.id

  const editorNotes = await prisma.note.findMany({
    where: {
      OR: [{ clientId: clientUserId }, { clientId: resolvedClientRowId }],
    },
    orderBy: { createdAt: 'desc' },
  })

  const sessionRows = await prisma.sessionNote.findMany({
    where: { clientId: resolvedClientRowId },
    orderBy: { createdAt: 'desc' },
  })

  const incomplete = await getIncompleteForms(prisma, clientUserId)
  const forms = FORM_ORDER.map((key) => ({
    label: FORM_LABELS[key],
    status: incomplete.includes(key) ? ('pending' as const) : ('complete' as const),
  }))

  const { fname, lname } = parseName(user.name)
  const displayName =
    formatStoredUserNameForDisplay(lname ? `${fname} ${lname}` : fname || user.name || '') ||
    formatStoredUserNameForDisplay(user.name)

  return {
    client: { id: clientUserId, name: displayName },
    currentNote: {
      id: 0,
      date: new Date().toLocaleDateString('en-US'),
      content: '',
    },
    previousNotes: editorNotes.map((n) => ({
      id: n.id,
      date: new Date(n.createdAt).toLocaleDateString('en-US'),
      preview: n.content.slice(0, 60) + (n.content.length > 60 ? '...' : ''),
      content: n.content,
      createdAt: n.createdAt.toISOString(),
    })),
    sessionNotes: sessionRows.map((s) => ({
      id: s.id,
      content: s.content,
      createdAt: s.createdAt.toISOString(),
    })),
    forms,
  }
})
