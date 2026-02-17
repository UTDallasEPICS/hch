import { prisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  const list = await prisma.question.findMany({
    orderBy: { createdAt: 'asc' },
  })
  return list.map((q) => ({
    id: q.id,
    text: q.text,
    type: q.type,
    alias: q.alias,
    options: q.options ? (JSON.parse(q.options) as string[]) : undefined,
  }))
})
