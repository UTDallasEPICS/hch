import { defineEventHandler } from 'h3'
import { requireClientUser } from '../../utils/guard'
import { decryptMessage } from '../../utils/message-encryption'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireClientUser(event)

  const conversation = await prisma.conversation.findUnique({
    where: { clientUserId: user.id },
  })
  if (!conversation) {
    return { conversationId: null, messages: [] }
  }

  // Opening the conversation marks messages from admins as read. The client's own messages stay unread until an admin opens them.
  await prisma.message.updateMany({
    where: {
      conversationId: conversation.id,
      senderId: { not: user.id },
      readAt: null,
    },
    data: { readAt: new Date() },
  })

  const rows = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { sentAt: 'asc' },
  })

  return {
    conversationId: conversation.id,
    messages: rows.map((row) => ({
      id: row.id,
      senderId: row.senderId,
      text: decryptMessage(row.ciphertext),
      sentAt: row.sentAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
      mine: row.senderId === user.id,
    })),
  }
})
