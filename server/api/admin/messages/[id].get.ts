import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireAdmin } from '../../../utils/guard'
import { decryptMessage } from '../../../utils/message-encryption'
import { formatStoredUserNameForDisplay } from '../../../utils/name'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing conversation id' })
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true, email: true } } },
  })
  if (!conversation) {
    throw createError({ statusCode: 404, statusMessage: 'Conversation not found' })
  }

  const openedAt = new Date()
  await prisma.$transaction([
    prisma.message.updateMany({
      where: {
        conversationId: conversation.id,
        senderId: conversation.clientUserId,
        readAt: null,
      },
      data: { readAt: openedAt },
    }),
    prisma.messageAccessLog.create({
      data: {
        adminUserId: admin.id,
        conversationId: conversation.id,
        accessedAt: openedAt,
      },
    }),
  ])

  const rows = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { sentAt: 'asc' },
  })

  return {
    conversationId: conversation.id,
    client: {
      id: conversation.client.id,
      name: formatStoredUserNameForDisplay(conversation.client.name) || conversation.client.email,
      email: conversation.client.email,
    },
    messages: rows.map((row) => ({
      id: row.id,
      senderId: row.senderId,
      text: decryptMessage(row.ciphertext),
      sentAt: row.sentAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
      mine: row.senderId === admin.id,
    })),
  }
})
