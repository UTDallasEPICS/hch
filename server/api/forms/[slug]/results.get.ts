import { prisma } from '../../../utils/prisma'
import { auth } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, message: 'Missing form slug' })
  }

  const session = await auth.api.getSession({
    headers: event.node.req.headers,
  })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  const userId = session.user.id

  const form = await prisma.form.findUnique({
    where: { slug },
    include: {
      formQuestions: {
        orderBy: { order: 'asc' },
        include: { question: true },
      },
    },
  })

  if (!form) {
    throw createError({ statusCode: 404, message: 'Form not found' })
  }

  let responses: Record<string, string> = {}
  let completedAt: Date | null = null

  if (slug === 'ace-form') {
    const aceResponse = await prisma.aceResponse.findFirst({
      where: { userId },
      orderBy: { completedAt: 'desc' },
    })
    if (aceResponse) {
      responses = JSON.parse(aceResponse.responses)
      completedAt = aceResponse.completedAt
    }
  }
  // Future: other form slugs could query other response tables

  // Calculate score (for ACE: count of "Yes" answers)
  let score = 0
  if (slug === 'ace-form') {
    score = Object.values(responses).filter((v) => v === 'Yes' || v === 'true').length
  }

  return {
    form: {
      id: form.id,
      title: form.title,
      description: form.description,
      slug: form.slug,
      questions: form.formQuestions.map((fq) => ({
        id: fq.question.id,
        text: fq.question.text,
        type: fq.question.type,
        alias: fq.question.alias,
        options: fq.question.options ? (JSON.parse(fq.question.options) as string[]) : undefined,
        order: fq.order,
      })),
    },
    responses,
    score,
    completedAt,
    totalQuestions: form.formQuestions.length,
  }
})
