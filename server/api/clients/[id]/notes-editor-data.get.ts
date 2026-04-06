import { requireAdmin } from '../../../utils/guard'
import { createError, defineEventHandler, getHeaders, getRouterParam } from 'h3'
import { prisma } from '../../../utils/prisma'
import { isAdmin } from '../../../utils/is-admin'
import { getIncompleteForms, FORM_LABELS } from '../../../utils/client-forms'
import { formatStoredUserNameForDisplay, parseName } from '../../../utils/name'

const FORM_ORDER = ['application', 'ace', 'gad', 'phq', 'pcl'] as const

export default defineEventHandler(async (event) => {

  const user = requireAdmin(event)

  const clientUserId = getRouterParam(event, 'id')
  if (!clientUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: clientUserId, role: 'CLIENT' },
    include: { client: true },
  })

  if (!dbUser) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  let clientRow = dbUser.client
  if (!clientRow) {
    clientRow = await prisma.client.create({
      data: { userId: clientUserId },
    })
  }

  const resolvedClientRowId = clientRow.id

  const sessionRows = await prisma.sessionNote.findMany({
    where: { clientId: resolvedClientRowId },
    orderBy: { createdAt: 'desc' },
  })

  const incomplete = await getIncompleteForms(prisma, clientUserId)
  const forms = FORM_ORDER.map((key) => ({
    label: FORM_LABELS[key],
    status: incomplete.includes(key) ? ('pending' as const) : ('complete' as const),
  }))

  const { fname, lname } = parseName(dbUser.name)
  const displayName =
    formatStoredUserNameForDisplay(lname ? `${fname} ${lname}` : fname || dbUser.name || '') ||
    formatStoredUserNameForDisplay(dbUser.name)

  return {
    client: { id: clientUserId, name: displayName },
    currentNote: {
      id: 0,
      date: new Date().toLocaleDateString('en-US'),
      content: '',
    },
    previousNotes: [], // Deprecated: Kept to satisfy frontend types for now
    sessionNotes: sessionRows.map((s) => ({
      id: s.id,
      content: s.content,
      createdAt: s.createdAt.toISOString(),
      preview: s.content.slice(0, 60) + (s.content.length > 60 ? '...' : ''),
    })),
    forms,
  }
})
