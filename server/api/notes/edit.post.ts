import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const existingNote = await prisma.note.findUnique({
    where: { id: body.noteId }
  })

  if (!existingNote) {
    throw createError({ statusCode: 404, statusMessage: 'Note not found' })
  }

  // Save edit history
  await prisma.noteEdit.create({
    data: {
      noteId: body.noteId,
      originalContent: existingNote.content,
      reason: body.reason,
      signature: body.signature
    }
  })

  // Update the note
  const updated = await prisma.note.update({
    where: { id: body.noteId },
    data: { content: body.content }
  })

  return updated
})