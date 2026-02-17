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

type ImportQuestion = { text: string; type?: string; options?: string[] }

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { questions: raw } = body as { questions?: unknown }

  if (!Array.isArray(raw) || raw.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'questions array is required and must not be empty',
    })
  }

  const questions: ImportQuestion[] = raw
    .map((q) => {
      if (
        q &&
        typeof q === 'object' &&
        'text' in q &&
        typeof (q as ImportQuestion).text === 'string'
      ) {
        const t = (q as ImportQuestion).text.trim()
        if (!t) return null
        const type =
          typeof (q as ImportQuestion).type === 'string' ? (q as ImportQuestion).type! : 'radio'
        const opts = Array.isArray((q as ImportQuestion).options)
          ? (q as ImportQuestion).options!.filter(
              (o): o is string => typeof o === 'string' && o.trim() !== ''
            )
          : []
        const options = opts.length > 0 ? opts : defaultOptions(type)
        return { text: t, type, options: options.length > 0 ? options : undefined }
      }
      if (typeof q === 'string' && q.trim()) return { text: q.trim(), type: 'radio' as const }
      return null
    })
    .filter((q): q is ImportQuestion => q !== null)

  if (questions.length === 0) {
    throw createError({ statusCode: 400, message: 'No valid questions to import' })
  }

  const existing = await prisma.question.findMany({ select: { alias: true } })
  let existingAliases = existing.map((q) => q.alias)
  const ids: string[] = []

  for (const q of questions) {
    const alias = generateAlias(q.text, existingAliases)
    existingAliases = [...existingAliases, alias]
    const type = q.type || 'radio'
    const optionsArray = q.options && q.options.length > 0 ? q.options : defaultOptions(type)
    const question = await prisma.question.create({
      data: {
        text: q.text.trim(),
        type,
        alias,
        options: optionsArray.length > 0 ? JSON.stringify(optionsArray) : null,
      },
    })
    ids.push(question.id)
  }

  return { ids, count: ids.length }
})
