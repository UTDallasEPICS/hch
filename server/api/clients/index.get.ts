import { requireStaff } from '../../utils/guard'
import { createError, defineEventHandler, getHeaders, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { isAdmin } from '../../utils/is-admin'
import {
  isAllFormsComplete,
  areAllFormsComplete,
  isWaitlistFormsComplete,
  getIncompleteForms,
} from '../../utils/client-forms'
import { isClinicalClient } from '../../utils/is-clinical-client'
import {
  isClientStatusLabel,
  toClientStatusLabel,
  toDbClientStatus,
} from '../../utils/client-status'
import { joinName, parseName } from '../../utils/name'
import type { ClientStatus } from '../../../prisma/generated/client'

export default defineEventHandler(async (event) => {
  const user = requireStaff(event)
  const isClinicianViewer = event.context.isClinician === true && !event.context.isAdmin
  const isAdminViewer = event.context.isAdmin === true

  const query = getQuery(event)
  const statusFilter = query.status as string | undefined
  const clinicianUserIds =
    isAdminViewer && typeof query.clinicianUserId === 'string'
      ? query.clinicianUserId
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : []
  const hasClinicianUserIdFilter = clinicianUserIds.length > 0

  const hasStatusFilter = Boolean(statusFilter && isClientStatusLabel(statusFilter))
  const dbStatusFilter = toDbClientStatus(statusFilter)

  // Build where clause. Clinicians only see clients assigned to them -- and
  // because "unassigned client record" and "no client record yet" both have no
  // clinicianUserId, clinicians never see INCOMPLETE-with-no-record entries.
  type UserWhere = NonNullable<Parameters<typeof prisma.user.findMany>[0]>['where']
  let where: UserWhere = { role: 'CLIENT' }

  if (isClinicianViewer) {
    const clientFilter: { clinicianUserId: string; status?: ClientStatus } = {
      clinicianUserId: user.id,
    }
    if (hasStatusFilter) clientFilter.status = dbStatusFilter as ClientStatus
    where = { ...where, client: clientFilter }
  } else {
    const adminClientFilter: {
      clinicianUserId?: string | { in: string[] }
      status?: ClientStatus
    } = {}
    if (hasClinicianUserIdFilter) adminClientFilter.clinicianUserId = { in: clinicianUserIds }

    if (hasStatusFilter) {
      if (dbStatusFilter === 'INCOMPLETE') {
        where = {
          ...where,
          OR: hasClinicianUserIdFilter
            ? [{ client: { ...adminClientFilter, status: 'INCOMPLETE' as ClientStatus } }]
            : [{ client: null }, { client: { status: 'INCOMPLETE' as ClientStatus } }],
        }
      } else {
        where = {
          ...where,
          client: { ...adminClientFilter, status: dbStatusFilter as ClientStatus },
        }
      }
    } else {
      if (hasClinicianUserIdFilter) {
        where = { ...where, client: adminClientFilter }
      }
    }
  }

  const users = await prisma.user.findMany({
    where,
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

  const clinicalUsers = users.filter((u) => isClinicalClient(u.role, u.email))

  const clients = await Promise.all(
    clinicalUsers.map(async (user) => {
      const clientProfile = user.client
      const storedStatus = (clientProfile?.status ?? 'INCOMPLETE') as ClientStatus
      const statusLabel = toClientStatusLabel(storedStatus)
      const therapyWeek = clientProfile?.therapyWeek ?? null
      const missedSessions = clientProfile?.missedSessions ?? 0
      const allFormsComplete =
        storedStatus === 'WAITLIST'
          ? await isWaitlistFormsComplete(prisma, user.id)
          : await areAllFormsComplete(prisma, user.id)
      const incompleteForms =
        storedStatus === 'INCOMPLETE' || storedStatus === 'WAITLIST'
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
        status: statusLabel,
        allFormsComplete,
        therapyWeek,
        missedSessions,
        incompleteForms,
      }
    })
  )

  return clients
})
