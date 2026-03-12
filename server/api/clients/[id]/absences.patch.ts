import { createError, defineEventHandler, getHeaders, getRouterParam, readBody } from 'h3'
import { auth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { isAdmin } from '../../../utils/is-admin'
import { saveBase64File, saveSignaturePng } from '../../../utils/file-upload'

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

  // Persist a PNG copy of each signature for server-side archival.
  const signaturePath = await saveSignaturePng(body.signatureData)

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

  const user = await prisma.user.findFirst({
    where: { id: clientUserId, role: 'CLIENT' },
    include: { client: true },
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  let client = user.client
  if (!client) {
    client = await prisma.client.create({
      data: { userId: clientUserId, missedSessions: body.missedSessions },
    })
    const createAuditData: any = {
      entityType: 'ABSENCE',
      entityId: clientUserId,
      oldValue: null,
      newValue: JSON.stringify({ missedSessions: body.missedSessions }),
      reasoning: body.reasoning?.trim() || null,
      documentationPath,
      documentationName,
      signaturePath,
      signatureData: body.signatureData,
      signedById: session.user.id,
    }
    await prisma.changeAudit.create({
      data: createAuditData as any,
    })
  } else {
    const oldSessions = client.missedSessions
    client = await prisma.client.update({
      where: { id: client.id },
      data: { missedSessions: body.missedSessions },
    })
    const createAuditData: any = {
      entityType: 'ABSENCE',
      entityId: clientUserId,
      oldValue: JSON.stringify({ missedSessions: oldSessions }),
      newValue: JSON.stringify({ missedSessions: body.missedSessions }),
      reasoning: body.reasoning?.trim() || null,
      documentationPath,
      documentationName,
      signaturePath,
      signatureData: body.signatureData,
      signedById: session.user.id,
    }
    await prisma.changeAudit.create({
      data: createAuditData as any,
    })
  }

  return { missedSessions: client.missedSessions }
})
