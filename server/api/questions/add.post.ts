import { prisma } from '../../utils/prisma'

function generateAlias(text: string, existingAliases: string[]): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 30)
  let alias = base || 'question'
  let n = 0
  while (existingAliases.includes(alias)) {
    n += 1
    alias = `${base}_${n}`
  }
  return alias
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { text, type } = body as { text?: string; type?: string }

  if (!text || typeof text !== 'string') {
    throw createError({ statusCode: 400, message: 'Question text is required' })
  }

  const existing = await prisma.question.findMany({ select: { alias: true } })
  const existingAliases = existing.map((q) => q.alias)
  const alias = generateAlias(text, existingAliases)

  const question = await prisma.question.create({
    data: {
      text: text.trim(),
      type: type || 'radio',
      alias,
    },
  })

  return { id: question.id, text: question.text, type: question.type, alias: question.alias }
})
