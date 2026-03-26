import { createError, defineEventHandler, getHeaders, getQuery } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { isAdmin } from '../../utils/is-admin'
import {
  isAllFormsComplete,
  isWaitlistFormsComplete,
  getIncompleteForms,
} from '../../utils/client-forms'
import { joinName, parseName } from '../../utils/name'
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

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, email: true },
  })
  if (!isAdmin(currentUser?.role ?? null, currentUser?.email ?? null)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }

  const query = getQuery(event)
  const statusFilter = query.status as string | undefined

  const validStatuses = ['Prospective', 'Waitlist', 'Active', 'Archived']
  const hasStatusFilter = statusFilter && validStatuses.includes(statusFilter)

  const users = await prisma.user.findMany({
    where: {
      role: 'CLIENT',
      ...(hasStatusFilter &&
        (statusFilter === 'Prospective'
          ? {
              OR: [{ client: null }, { client: { status: 'Prospective' as ClientStatus } }],
            }
          : {
              client: {
                status: statusFilter as ClientStatus,
              },
            })),
    },
    include: {
      client: true,
      appForms: {
        orderBy: { id: 'desc' },
        take: 1,
        include: {
          questions: {
            select: {
              q02: true,
              q03: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const clients = await Promise.all(
    users.map(async (user) => {
      const clientProfile = user.client
      const storedStatus = clientProfile?.status ?? 'Prospective'
      const therapyWeek = clientProfile?.therapyWeek ?? null
      const missedSessions = clientProfile?.missedSessions ?? 0
      const allFormsComplete =
        storedStatus === 'Waitlist'
          ? await isWaitlistFormsComplete(prisma, user.id)
          : await isAllFormsComplete(prisma, user.id)
      const incompleteForms =
        storedStatus === 'Prospective' || storedStatus === 'Waitlist'
          ? await getIncompleteForms(prisma, user.id, storedStatus)
          : []
      const latestAnswers = user.appForms[0]?.questions
      const fallbackName = joinName(latestAnswers?.q02 ?? '', latestAnswers?.q03 ?? '')
      const resolvedName = user.name?.trim() ? user.name : fallbackName
      const { fname, lname } = parseName(resolvedName)

      return {
        id: user.id,
        fname,
        lname,
        name: resolvedName,
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
