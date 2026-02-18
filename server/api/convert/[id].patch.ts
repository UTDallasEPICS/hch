import { prisma } from '../../utils/prisma'

interface FieldPatch {
  fieldId: string
  label?: string
  type?: string
  options?: string[] | null
  isDeleted?: boolean
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing document id.' })

  const body = await readBody<{ fields: FieldPatch[] }>(event)
  if (!Array.isArray(body?.fields)) {
    throw createError({ statusCode: 400, message: 'Body must be { fields: FieldPatch[] }' })
  }

  const updates = body.fields.map((patch) =>
    prisma.extractedField.update({
      where: { id: patch.fieldId },
      data: {
        ...(patch.label     !== undefined && { label: patch.label }),
        ...(patch.type      !== undefined && { type: patch.type }),
        ...(patch.options   !== undefined && {
          options: patch.options ? JSON.stringify(patch.options) : null,
        }),
        ...(patch.isDeleted !== undefined && { isDeleted: patch.isDeleted }),
      },
    })
  )

  await Promise.all(updates)
  return { ok: true }
})
