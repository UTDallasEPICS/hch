/**
 * Shared loaders for ACE, GAD-7, PHQ-9, PCL-5 — used by client form GET and score history snapshots.
 */
import type { PrismaClient } from '../../prisma/generated/client'

export const GAD_LABELS = [
  'Feeling nervous, anxious or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  "Being so restless that it's hard to sit still",
  'Becoming easily annoyed or irritable',
  'Feeling afraid as if something awful might happen',
  'If you checked any problems, how difficult have they made it for you?',
]

export const PHQ_LABELS = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling or staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself',
  'Trouble concentrating on things',
  'Moving or speaking slowly / fidgety or restless',
  'Thoughts that you would be better off dead',
  'If you checked any problems, how difficult have they made it?',
]

export const PHQ_OPTIONS: Record<number, string> = {
  0: 'Not at all',
  1: 'Several days',
  2: 'More than half the days',
  3: 'Nearly every day',
}

export const GAD_OPTIONS: Record<number, string> = {
  0: 'Not at all',
  1: 'Several days',
  2: 'More than half the days',
  3: 'Nearly every day',
}

const ACE_QUESTIONS_TEXT = [
  'Did a parent or other adult in the household often swear at you, insult you, put you down, or humiliate you?',
  'Did a parent or other adult in the household often push, grab, slap, or throw something at you?',
  'Did an adult or person at least 5 years older ever touch or fondle you or have you touch their body in a sexual way?',
  'Did you often feel that no one in your family loved you or thought you were important or special?',
  "Did you often feel that you didn't have enough to eat, had to wear dirty clothes, and had no one to protect you?",
  'Were your parents ever separated or divorced?',
  'Was your mother or stepmother often pushed, grabbed, slapped, or had something thrown at her?',
  'Did you live with anyone who was a problem drinker or alcoholic or who used street drugs?',
  'Was a household member depressed or mentally ill, or did a household member attempt suicide?',
  'Did a household member go to prison?',
]

export type ClinicalFormQuestionRow = { label: string; answer: string }

/** Load formatted Q&A for the client’s current row of each clinical form (same labels/order as form GET). */
export async function loadClinicalFormQuestions(
  prisma: PrismaClient,
  userId: string,
  formKey: 'ace' | 'gad' | 'phq' | 'pcl'
): Promise<ClinicalFormQuestionRow[]> {
  if (formKey === 'ace') {
    const aceForm = await prisma.aceForm.findFirst({
      where: { userId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    })
    let q = aceForm?.questions ?? null
    if (!q && aceForm) {
      q = await prisma.aceQuestion.findFirst({ where: { userId } })
    }
    if (!q) return []
    const answers = [q.a01, q.a02, q.a03, q.a04, q.a05, q.a06, q.a07, q.a08, q.a09, q.a10]
    return ACE_QUESTIONS_TEXT.map((text, i) => ({
      label: text,
      answer: answers[i] ?? '',
    }))
  }

  if (formKey === 'gad') {
    const gadForm = await prisma.gadForm.findFirst({
      where: { userId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    })
    let q = gadForm?.questions ?? null
    if (!q && gadForm) {
      q =
        (await prisma.gadQuestion.findFirst({ where: { formId: gadForm.id } })) ??
        (await prisma.gadQuestion.findFirst({ where: { userId } }))
    }
    if (!q) return []
    const answers = [q.g01, q.g02, q.g03, q.g04, q.g05, q.g06, q.g07, q.g08]
    return GAD_LABELS.slice(0, answers.length).map((label, i) => ({
      label,
      answer: answers[i] != null ? (GAD_OPTIONS[answers[i] as number] ?? String(answers[i])) : '',
    }))
  }

  if (formKey === 'phq') {
    const phqForm = await prisma.phqForm.findFirst({
      where: { userId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    })
    let q = phqForm?.questions ?? null
    if (!q && phqForm) {
      q = await prisma.phqQuestion.findFirst({ where: { formId: phqForm.id } })
    }
    if (!q) return []
    const answers = [q.q1, q.q2, q.q3, q.q4, q.q5, q.q6, q.q7, q.q8, q.q9, q.q10]
    return PHQ_LABELS.slice(0, answers.length).map((label, i) => ({
      label,
      answer: answers[i] != null ? (PHQ_OPTIONS[answers[i] as number] ?? String(answers[i])) : '',
    }))
  }

  const pclForm = await prisma.pclForm.findFirst({
    where: { userId },
    orderBy: { id: 'desc' },
    include: { questions: true },
  })
  let q = pclForm?.questions ?? null
  if (!q && pclForm) {
    q =
      (await prisma.pclQuestion.findFirst({ where: { formId: pclForm.id } })) ??
      (await prisma.pclQuestion.findFirst({ where: { userId } }))
  }
  if (!q) return []
  const questions: ClinicalFormQuestionRow[] = []
  for (let i = 1; i <= 20; i++) {
    const key = `q${String(i).padStart(2, '0')}` as keyof typeof q
    const val = q[key]
    const numVal = typeof val === 'number' ? val : null
    if (numVal != null && numVal >= 0) {
      questions.push({ label: `Item ${i}`, answer: String(numVal) })
    }
  }
  return questions
}
