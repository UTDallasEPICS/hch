import { defineEventHandler } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireUser } from '../../../utils/guard'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const record = await prisma.physicianStatementForm.findUnique({
    where: { userId: user.id },
    select: {
      status: true,
      uploadedAt: true,
      originalFileName: true,
      storedFileName: true,
    },
  })

  const submitted = record?.status === 'SUBMITTED'

  return {
    submitted,
    uploadedAt: record?.uploadedAt?.toISOString() ?? null,
    originalFileName: record?.originalFileName ?? null,
    templateUrl: '/physician-statement-form.pdf',
    uploadedFileUrl:
      submitted && record?.storedFileName ? '/api/forms/physician-statement/download' : null,
  }
})
