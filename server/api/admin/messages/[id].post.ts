import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { requireAdmin } from '../../../utils/guard'
import { encryptMessage } from '../../../utils/message-encryption'
import { notifyClientOfAdminMessage } from '../../../utils/message-notifications'
import { parseMessageText } from '../../../utils/message-text'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing conversation id' })
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: { id: true, clientUserId: true },
  })
  if (!conversation) {
    throw createError({ statusCode: 404, statusMessage: 'Conversation not found' })
  }

  const body = await readBody(event)
  const text = parseMessageText(body?.text)
  const sentAt = new Date()
  const ciphertext = encryptMessage(text)

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId: admin.id,
        ciphertext,
        sentAt,
      },
    })
    await tx.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: sentAt },
    })
    return created
  })

  await notifyClientOfAdminMessage(conversation.clientUserId)

  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    text,
    sentAt: message.sentAt.toISOString(),
    readAt: null,
    mine: true,
  }
})
