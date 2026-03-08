import { prisma } from '../../utils/prisma'
import { getAceFormQuestions } from '../../utils/ace-questions'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, message: 'Missing form slug' })
  }

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

  // ACE form: questions from front-end constant, not database (Form + AceResponse tables only)
  if (slug === 'ace-form') {
    return {
      id: form.id,
      title: form.title,
      description: form.description,
      slug: form.slug,
      questions: getAceFormQuestions(),
    }
  }

  const formWithQuestions = form as typeof form & {
    formQuestions: Array<{ question: { id: string; text: string; type: string; alias: string }; order: number }>
  }
  return {
    id: form.id,
    title: form.title,
    description: form.description,
    slug: form.slug,
    questions: formWithQuestions.formQuestions.map((fq) => ({
      id: fq.question.id,
      text: fq.question.text,
      type: fq.question.type,
      alias: fq.question.alias,
      order: fq.order,
    })),
  }
})
