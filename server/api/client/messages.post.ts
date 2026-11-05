import { defineEventHandler, readBody } from 'h3'
import { requireClientUser } from '../../utils/guard'
import { encryptMessage } from '../../utils/message-encryption'
import { notifyAdminsOfClientMessage } from '../../utils/message-notifications'
import { parseMessageText } from '../../utils/message-text'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireClientUser(event)
  const body = await readBody(event)
  const text = parseMessageText(body?.text)
  const sentAt = new Date()
  const ciphertext = encryptMessage(text)

  const message = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.upsert({
      where: { clientUserId: user.id },
      create: { clientUserId: user.id, lastMessageAt: sentAt },
      update: { lastMessageAt: sentAt },
    })
    return tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId: user.id,
        ciphertext,
        sentAt,
      },
    })
  })

  await notifyAdminsOfClientMessage()

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
