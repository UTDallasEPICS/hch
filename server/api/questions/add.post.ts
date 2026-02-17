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

function defaultOptions(type: string): string[] {
  if (type === 'radio') return ['Yes', 'No']
  if (type === 'checkbox') return ['Yes']
  return []
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const {
    text,
    type,
    options: rawOptions,
  } = body as {
    text?: string
    type?: string
    options?: string[]
  }

  if (!text || typeof text !== 'string') {
    throw createError({ statusCode: 400, message: 'Question text is required' })
  }

  const questionType = type || 'radio'
  const optionsArray =
    Array.isArray(rawOptions) && rawOptions.length > 0
      ? rawOptions.filter((o): o is string => typeof o === 'string' && o.trim() !== '')
      : defaultOptions(questionType)
  const optionsJson = optionsArray.length > 0 ? JSON.stringify(optionsArray) : null

  const existing = await prisma.question.findMany({ select: { alias: true } })
  const existingAliases = existing.map((q) => q.alias)
  const alias = generateAlias(text, existingAliases)

  const question = await prisma.question.create({
    data: {
      text: text.trim(),
      type: questionType,
      alias,
      options: optionsJson,
    },
  })

  const options = question.options ? (JSON.parse(question.options) as string[]) : undefined
  return {
    id: question.id,
    text: question.text,
    type: question.type,
    alias: question.alias,
    options,
  }
})
