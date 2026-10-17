import { createError, defineEventHandler, readBody } from 'h3'
import { requireAdmin } from '../../../utils/guard'
import { encryptMessage } from '../../../utils/message-encryption'
import { parseMessageText } from '../../../utils/message-text'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
  const body = await readBody(event)
  const clientUserId = typeof body?.clientUserId === 'string' ? body.clientUserId.trim() : ''
  if (!clientUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Client is required' })
  }
  const text = parseMessageText(body?.text)

  const client = await prisma.user.findUnique({
    where: { id: clientUserId },
    select: { id: true, role: true },
  })
  if (!client || client.role !== 'CLIENT') {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  const sentAt = new Date()
  const ciphertext = encryptMessage(text)
  const message = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.upsert({
      where: { clientUserId },
      create: { clientUserId, lastMessageAt: sentAt },
      update: { lastMessageAt: sentAt },
    })
    return tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId: admin.id,
        ciphertext,
        sentAt,
      },
    })
  })

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
