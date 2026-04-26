import { requireStaff } from '../../../utils/guard'
import { assertStaffCanAccessClient } from '../../../utils/clinician-access'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { prisma } from '../../../utils/prisma'
import {
  getIncompleteForms,
  getWaitlistIncompleteForms,
  FORM_LABELS,
} from '../../../utils/client-forms'
import { formatStoredUserNameForDisplay, parseName } from '../../../utils/name'

const FORM_ORDER = ['application', 'ace', 'gad', 'phq', 'pcl'] as const

export default defineEventHandler(async (event) => {

  const user = requireStaff(event)

  const clientUserId = getRouterParam(event, 'id')
  if (!clientUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }
  await assertStaffCanAccessClient(event, clientUserId)

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
    include: {
      appointment: {
        select: { startTime: true },
      },
    },
  })
  const appointmentRows = await prisma.appointment.findMany({
    where: { clientId: clientUserId },
    orderBy: { startTime: 'desc' },
    select: {
      id: true,
      sessionName: true,
      sessionNumber: true,
      startTime: true,
      status: true,
    },
  })

  // Application uses prospective requirements; ACE/GAD/PHQ/PCL use waitlist clinical checks (see client-forms).
  // Using only `getIncompleteForms(clientStatus)` mislabels the four clinical forms as "complete" for
  // prospective clients because that list omits ace/gad/phq/pcl.
  const [prospectiveIncomplete, waitlistClinicalIncomplete] = await Promise.all([
    getIncompleteForms(prisma, clientUserId, 'INCOMPLETE'),
    getWaitlistIncompleteForms(prisma, clientUserId),
  ])

  const forms = FORM_ORDER.map((key) => {
    const pending =
      key === 'application'
        ? prospectiveIncomplete.includes('application')
        : waitlistClinicalIncomplete.includes(key)
    return {
      label: FORM_LABELS[key],
      status: pending ? ('pending' as const) : ('complete' as const),
    }
  })

  const storedName = dbUser.name ?? ''
  const { fname, lname } = parseName(storedName)
  const displayName =
    formatStoredUserNameForDisplay(lname ? `${fname} ${lname}` : fname || storedName || '') ||
    formatStoredUserNameForDisplay(storedName)

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
      sessionName: s.sessionName,
      sessionNumber: s.sessionNumber,
      appointmentId: s.appointmentId,
      appointmentStartTime: s.appointment?.startTime?.toISOString() ?? null,
      preview: s.content.slice(0, 60) + (s.content.length > 60 ? '...' : ''),
      kind: s.kind,
      status: s.status,
      clinicianSignedAt: s.clinicianSignedAt?.toISOString() ?? null,
      clinicianSignedById: s.clinicianSignedById,
      adminSignedAt: s.adminSignedAt?.toISOString() ?? null,
      adminSignedById: s.adminSignedById,
      adminApprovalNote: s.adminApprovalNote,
    })),
    appointments: appointmentRows.map((a) => ({
      id: a.id,
      sessionName: a.sessionName,
      sessionNumber: a.sessionNumber,
      startTime: a.startTime.toISOString(),
      status: a.status,
    })),
    forms,
  }
})
