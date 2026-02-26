import { prisma } from '../../utils/prisma'
import { getAceFormQuestions } from '../../utils/ace-questions'

export default defineEventHandler(async () => {
  const forms = await prisma.form.findMany({
    include: {
      formQuestions: {
        orderBy: { order: 'asc' },
        include: { question: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return forms.map((f) => {
    // ACE form: questions from front-end constant
    if (f.slug === 'ace-form') {
      const questions = getAceFormQuestions()
      return {
        id: f.id,
        title: f.title,
        description: f.description,
        slug: f.slug,
        questionCount: questions.length,
        questions,
      }
    }
    return {
      id: f.id,
      title: f.title,
      description: f.description,
      slug: f.slug,
      questionCount: f.formQuestions.length,
      questions: f.formQuestions.map((fq) => ({
        id: fq.question.id,
        text: fq.question.text,
        type: fq.question.type,
        alias: fq.question.alias,
        order: fq.order,
      })),
    }
  })
})
