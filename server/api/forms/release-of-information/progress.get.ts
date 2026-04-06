import { defineEventHandler } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireUser } from '../../../utils/guard'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const record = await prisma.releaseOfInformationAuthorizationForm.findUnique({
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
    templateUrl: '/release-of-information-authorization-form.pdf',
    uploadedFileUrl:
      submitted && record?.storedFileName ? '/api/forms/release-of-information/download' : null,
  }
})
