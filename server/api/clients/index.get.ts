import { createError, defineEventHandler, getHeaders, getQuery } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { isAllFormsComplete, getIncompleteForms } from '../../utils/client-forms'
import { parseName } from '../../utils/name'
import type { ClientStatus } from '../../../../prisma/generated/client'

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const query = getQuery(event)
  const statusFilter = query.status as string | undefined

  const validStatuses = ['INCOMPLETE', 'WAITLIST', 'ACTIVE', 'ARCHIVED']
  const hasStatusFilter = statusFilter && validStatuses.includes(statusFilter)

  const users = await prisma.user.findMany({
    where: {
      role: 'CLIENT',
      ...(hasStatusFilter &&
        (statusFilter === 'INCOMPLETE'
          ? {
              OR: [
                { client: null },
                { client: { status: 'INCOMPLETE' as ClientStatus } },
              ],
            }
          : {
              client: {
                status: statusFilter as ClientStatus,
              },
            })),
    },
    include: {
      client: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const clients = await Promise.all(
    users.map(async (user) => {
      const clientProfile = user.client
      const storedStatus = clientProfile?.status ?? 'INCOMPLETE'
      const therapyWeek = clientProfile?.therapyWeek ?? null
      const missedSessions = clientProfile?.missedSessions ?? 0
      const allFormsComplete = await isAllFormsComplete(prisma, user.id)
      const incompleteForms = storedStatus === 'INCOMPLETE' ? await getIncompleteForms(prisma, user.id) : []
      const { fname, lname } = parseName(user.name)

      return {
        id: user.id,
        fname,
        lname,
        name: user.name,
        email: user.email,
        status: storedStatus,
        allFormsComplete,
        therapyWeek,
        missedSessions,
        incompleteForms,
      }
    })
  )

  return clients
})
