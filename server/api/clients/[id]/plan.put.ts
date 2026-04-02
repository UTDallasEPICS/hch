import { createError, defineEventHandler, getHeaders, getRouterParam, readBody } from 'h3'
import { auth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { isAdmin } from '../../../utils/is-admin'
import { isClinicalClient } from '../../../utils/is-clinical-client'
import { saveBase64File } from '../../../utils/file-upload'

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
    content?: string
    reasoning?: string
    documentationBase64?: string
    documentationFilename?: string
    signatureData: string
  }>(event)
  const hasReasoning = typeof body?.reasoning === 'string' && body.reasoning.trim().length > 0
  const hasDoc = typeof body?.documentationBase64 === 'string' && body.documentationBase64.length > 0
  if (!hasReasoning && !hasDoc) {
    throw createError({ statusCode: 400, statusMessage: 'Provide reasoning or documentation (PDF/Word)' })
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

  const user = await prisma.user.findFirst({
    where: { id: clientUserId, role: 'CLIENT' },
    include: { client: { include: { plan: true } } },
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  if (!isClinicalClient(user.role, user.email)) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  let client = user.client
  if (!client) {
    client = await prisma.client.create({
      data: { userId: clientUserId },
      include: { plan: true },
    })
  }

  const content = body?.content ?? ''
  const existingPlan = client.plan

  const plan = await prisma.clientPlan.upsert({
    where: { clientId: client.id },
    create: { clientId: client.id, content },
    update: { content },
  })

  await prisma.changeAudit.create({
    data: {
      entityType: 'TREATMENT_PLAN',
      entityId: client.id,
      oldValue: existingPlan ? JSON.stringify({ content: existingPlan.content }) : null,
      newValue: JSON.stringify({ content }),
      reasoning: body.reasoning?.trim() || null,
      documentationPath,
      documentationName,
      signatureData: body.signatureData,
      signedById: session.user.id,
    },
  })

  return plan
})
