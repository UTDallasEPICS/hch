import { requireStaff } from '../../../utils/guard'
import { assertStaffCanAccessClient } from '../../../utils/clinician-access'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { prisma } from '../../../utils/prisma'
import { isClinicalClient } from '../../../utils/is-clinical-client'
import { saveBase64File } from '../../../utils/file-upload'

export default defineEventHandler(async (event) => {
  const user = requireStaff(event)

  const clientUserId = getRouterParam(event, 'id')
  if (!clientUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }
  await assertStaffCanAccessClient(event, clientUserId)

  const body = await readBody<{
    missedSessions: number
    reasoning?: string
    documentationBase64?: string
    documentationFilename?: string
    signatureData: string
  }>(event)
  if (
    body?.missedSessions === undefined ||
    !Number.isInteger(body.missedSessions) ||
    body.missedSessions < 0
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'missedSessions must be a non-negative integer',
    })
  }
  const hasReasoning = typeof body.reasoning === 'string' && body.reasoning.trim().length > 0
  const hasDoc = typeof body.documentationBase64 === 'string' && body.documentationBase64.length > 0
  if (!hasReasoning && !hasDoc) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Provide reasoning or documentation (PDF/Word)',
    })
  }
  if (!body?.signatureData || typeof body.signatureData !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Admin signature is required' })
  }
  if (!body.signatureData.startsWith('data:image/png;base64,') || body.signatureData.length < 100) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid signature data format' })
  }

  let documentationPath: string | null = null
  let documentationName: string | null = null
  if (hasDoc && body.documentationBase64) {
    const savedFile = await saveBase64File(
      body.documentationBase64,
      body.documentationFilename || 'document'
    )
    documentationPath = savedFile.path
    documentationName = savedFile.originalName
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: clientUserId, role: 'CLIENT' },
    include: { client: true },
  })

  if (!dbUser) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  if (!isClinicalClient(dbUser.role, dbUser.email)) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  // Persist the absence change and its governed-change audit atomically: a failure
  // between the two must never leave a mutation without an audit record. (#90)
  let client = dbUser.client
  if (!client) {
    const [createdClient] = await prisma.$transaction([
      prisma.client.create({
        data: { userId: clientUserId, missedSessions: body.missedSessions },
      }),
      prisma.changeAudit.create({
        data: {
          entityType: 'ABSENCE',
          entityId: clientUserId,
          oldValue: null,
          newValue: JSON.stringify({ missedSessions: body.missedSessions }),
          reasoning: body.reasoning?.trim() || null,
          documentationPath,
          documentationName,
          signatureData: body.signatureData,
          signedById: user.id,
        },
      }),
    ])
    client = createdClient
  } else {
    const oldSessions = client.missedSessions
    const [updatedClient] = await prisma.$transaction([
      prisma.client.update({
        where: { id: client.id },
        data: { missedSessions: body.missedSessions },
      }),
      prisma.changeAudit.create({
        data: {
          entityType: 'ABSENCE',
          entityId: clientUserId,
          oldValue: JSON.stringify({ missedSessions: oldSessions }),
          newValue: JSON.stringify({ missedSessions: body.missedSessions }),
          reasoning: body.reasoning?.trim() || null,
          documentationPath,
          documentationName,
          signatureData: body.signatureData,
          signedById: user.id,
        },
      }),
    ])
    client = updatedClient
  }

  return { missedSessions: client.missedSessions }
})
