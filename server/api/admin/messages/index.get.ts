import { defineEventHandler } from 'h3'
import { requireAdmin } from '../../../utils/guard'
import { formatStoredUserNameForDisplay } from '../../../utils/name'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const conversations = await prisma.conversation.findMany({
    orderBy: { lastMessageAt: 'desc' },
    include: {
      client: { select: { name: true, email: true } },
      messages: {
        where: { readAt: null },
        select: { senderId: true },
      },
    },
  })

  return conversations.map((conversation) => ({
    id: conversation.id,
    clientUserId: conversation.clientUserId,
    clientName:
      formatStoredUserNameForDisplay(conversation.client.name) || conversation.client.email,
    clientEmail: conversation.client.email,
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    unreadCount: conversation.messages.filter(
      (message) => message.senderId === conversation.clientUserId
    ).length,
  }))
})
