import { prisma } from '../../../utils/prisma'
import { auth } from '../../../utils/auth'
import { getAceFormQuestions } from '../../../utils/ace-questions'

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
    ...(slug !== 'ace-form' && {
      include: {
        formQuestions: {
          orderBy: { order: 'asc' },
          include: { question: true },
        },
      },
    }),
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

  // Calculate score (for ACE: count of "Yes" answers)
  let score = 0
  if (slug === 'ace-form') {
    score = Object.values(responses).filter((v) => v === 'Yes' || v === 'true').length
  }

  // ACE form: questions from front-end constant
  const questions =
    slug === 'ace-form'
      ? getAceFormQuestions()
      : (form as any).formQuestions.map((fq: any) => ({
          id: fq.question.id,
          text: fq.question.text,
          type: fq.question.type,
          alias: fq.question.alias,
          order: fq.order,
        }))

  return {
    form: {
      id: form.id,
      title: form.title,
      description: form.description,
      slug: form.slug,
      questions,
    },
    responses,
    score,
    completedAt,
    totalQuestions: questions.length,
  }
})
