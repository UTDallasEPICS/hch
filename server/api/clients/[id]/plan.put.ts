import { requireStaff } from '../../../utils/guard'
import { assertStaffCanAccessClient } from '../../../utils/clinician-access'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { prisma } from '../../../utils/prisma'
import { saveBase64File } from '../../../utils/file-upload'

export default defineEventHandler(async (event) => {
  const user = requireStaff(event)

  const clientUserId = getRouterParam(event, 'id')
  if (!clientUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }
  await assertStaffCanAccessClient(event, clientUserId)

  const body = await readBody<{
    content?: string
    reasoning?: string
    documentationBase64?: string
    documentationFilename?: string
    signatureData: string
  }>(event)
  const hasReasoning = typeof body?.reasoning === 'string' && body.reasoning.trim().length > 0
  const hasDoc =
    typeof body?.documentationBase64 === 'string' && body.documentationBase64.length > 0
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
    include: { client: { include: { plan: true } } },
  })

  if (!dbUser) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  let client = dbUser.client
  if (!client) {
    client = await prisma.client.create({
      data: { userId: clientUserId },
      include: { plan: true },
    })
  }

  const content = body?.content ?? ''
  const existingPlan = client.plan

  // Persist the plan change and its governed-change audit atomically: a failure
  // between the two must never leave a mutation without an audit record. (#90)
  const [plan] = await prisma.$transaction([
    prisma.clientPlan.upsert({
      where: { clientId: client.id },
      create: { clientId: client.id, content },
      update: { content },
    }),
    prisma.changeAudit.create({
      data: {
        entityType: 'TREATMENT_PLAN',
        // Store the client's User id (matching ABSENCE audits) so one id retrieves
        // every audit type for a client via GET /api/audits. (#90)
        entityId: clientUserId,
        oldValue: existingPlan ? JSON.stringify({ content: existingPlan.content }) : null,
        newValue: JSON.stringify({ content }),
        reasoning: body.reasoning?.trim() || null,
        documentationPath,
        documentationName,
        signatureData: body.signatureData,
        signedById: user.id,
      },
    }),
  ])

  return plan
})
