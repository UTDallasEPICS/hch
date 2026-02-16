import { prisma } from '../../utils/prisma'
import { auth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.node.req.headers,
  })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  const userId = session.user.id

  const assignments = await prisma.formAssignment.findMany({
    where: { userId },
    include: {
      form: {
        include: {
          formQuestions: { orderBy: { order: 'asc' } },
        },
      },
    },
    orderBy: { assignedAt: 'desc' },
  })

  // Get saved responses for progress calculation
  const aceResponse = await prisma.aceResponse.findFirst({
    where: { userId },
    orderBy: { completedAt: 'desc' },
  })
  const savedResponses = aceResponse ? JSON.parse(aceResponse.responses) : {}

  const tasks = assignments.map((a) => {
    const total = a.form.formQuestions.length
    let progress = 0

    if (a.completedAt) {
      progress = 100
    } else if (a.form.slug === 'ace-form' && savedResponses) {
      // Calculate progress from saved responses
      const answeredCount = Object.keys(savedResponses).filter(
        (key) => savedResponses[key] && savedResponses[key] !== ''
      ).length
      progress = total > 0 ? Math.round((answeredCount / total) * 100) : 0
    }

    return {
      id: a.id,
      formId: a.form.id,
      title: a.form.title,
      description: a.form.description,
      slug: a.form.slug,
      assignedAt: a.assignedAt,
      completedAt: a.completedAt,
      progress,
      totalQuestions: total,
      status: a.completedAt ? 'COMPLETED' : 'IN_PROGRESS',
    }
  })

  return tasks
})
