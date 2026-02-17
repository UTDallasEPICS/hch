import { prisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  return prisma.question.findMany({
    orderBy: { createdAt: 'asc' },
  })
})
