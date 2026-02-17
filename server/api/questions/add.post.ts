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
  const {
    text,
    type,
    hasOther,
    options,
    gridRows,
    gridCols,
  } = body as {
    text?: string
    type?: string
    hasOther?: boolean
    options?: string[]
    gridRows?: string[]
    gridCols?: string[]
  }

  if (!text || typeof text !== 'string') {
    throw createError({ statusCode: 400, message: 'Question text is required' })
  }

  const existing = await prisma.question.findMany({ select: { alias: true } })
  const existingAliases = existing.map((q) => q.alias)
  const alias = generateAlias(text, existingAliases)

  const metadata: Record<string, unknown> = {}
  if (hasOther === true) metadata.hasOther = true
  if (Array.isArray(options) && options.length > 0) metadata.options = options
  if (Array.isArray(gridRows) && gridRows.length > 0) metadata.gridRows = gridRows
  if (Array.isArray(gridCols) && gridCols.length > 0) metadata.gridCols = gridCols
  const metadataValue =
    Object.keys(metadata).length > 0 ? metadata : undefined

  const question = await prisma.question.create({
    data: {
      text: text.trim(),
      type: type || 'radio',
      alias,
      metadata: metadataValue,
    },
  })

  return { id: question.id, text: question.text, type: question.type, alias: question.alias }
})
