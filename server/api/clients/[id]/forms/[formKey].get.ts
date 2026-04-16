import { requireUser } from '../../../../utils/guard'
import { createError, defineEventHandler, getHeaders, getRouterParam } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { isAdmin } from '../../../../utils/is-admin'

const APP_LABELS = [
  'Email',
  'First Name',
  'Last Name',
  'Phone Number',
  'Gender',
  'Date of Birth',
  'Address',
  "Child's First Name",
  "Child's Last Name",
  "Child's Date of Birth",
  'Gender (Child)',
  "Child's Address",
  'Medical Diagnosis',
  'Date of Medical Diagnosis',
  'Please list all members who live in the home',
  'Does the Child Reside with Both Biological Parents?',
  'Who Has Custody of the Child?',
  'Are You the Primary Contact?',
  "Legal Mother's First Name",
  "Legal Mother's Last Name",
  "Legal Mother's Address",
  "Legal Mother's City",
  "Legal Mother's State",
  "Legal Mother's Zip Code",
  "Legal Mother's Email",
  "Legal Mother's Occupation",
  'Is Legal Mother primary contact?',
  "Legal Father's First Name",
  "Legal Father's Last Name",
  "Legal Father's Address",
  "Legal Father's City",
  "Legal Father's State",
  "Legal Father's Zip Code",
  "Legal Father's Email",
  "Legal Father's Occupation",
  'Who is the primary caregiver?',
  'If child has/had siblings, did any witness a scary or traumatic event?',
  'Were siblings separated for a prolonged period from a parent and their sibling with cancer?',
  'Who was responsible for medical decisions?',
  'Who was primarily at the hospital during treatment?',
  'How long was the child in treatment?',
  'Were there any ICU visits?',
  'Were there any extended hospital admissions? If so, how long?',
  'Did the child have a relapse or secondary cancer?',
  'Did the child with cancer require hospice care and/or pass away?',
  'Are you applying for the Individual Therapy Scholarship?',
  'Would you like to join a Support Group waitlist?',
  'If seeking scholarship, who are you seeking therapy scholarship for?',
  'Do you have a therapist or need a referral?',
  'Do you currently have medical insurance that provides mental health coverage?',
]

const GAD_LABELS = [
  'Feeling nervous, anxious or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  "Being so restless that it's hard to sit still",
  'Becoming easily annoyed or irritable',
  'Feeling afraid as if something awful might happen',
  'If you checked any problems, how difficult have they made it for you?',
]

const PHQ_LABELS = [
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

const PHQ_OPTIONS: Record<number, string> = {
  0: 'Not at all',
  1: 'Several days',
  2: 'More than half the days',
  3: 'Nearly every day',
}

const GAD_OPTIONS: Record<number, string> = {
  0: 'Not at all',
  1: 'Several days',
  2: 'More than half the days',
  3: 'Nearly every day',
}

const PCL_LABELS = [
  'Repeated, disturbing, and unwanted memories of the stressful experience',
  'Repeated, disturbing dreams of the stressful experience',
  'Suddenly feeling or acting as if the stressful experience were actually happening again',
  'Feeling very upset when something reminded you of the stressful experience',
  'Having strong physical reactions when something reminded you of the stressful experience',
  'Avoiding memories, thoughts, or feelings related to the stressful experience',
  'Avoiding external reminders of the stressful experience',
  'Trouble remembering important parts of the stressful experience',
  'Having strong negative beliefs about yourself, other people, or the world',
  'Blaming yourself or someone else for the stressful experience or what happened after it',
  'Having strong negative feelings such as fear, horror, anger, guilt, or shame',
  'Loss of interest in activities that you used to enjoy',
  'Feeling distant or cut off from other people',
  'Trouble experiencing positive feelings',
  'Irritable behavior, angry outbursts, or acting aggressively',
  'Taking too many risks or doing things that could cause you harm',
  'Being "superalert" or watchful or on guard',
  'Feeling jumpy or easily startled',
  'Having difficulty concentrating',
  'Trouble falling or staying asleep',
]
export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const clientUserId = getRouterParam(event, 'id')
  const formKey = getRouterParam(event, 'formKey')
  if (!clientUserId || !formKey) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id or form key' })
  }

  // Allow admin to view any client's form answers, or client to view their own
  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, email: true },
  })
  const role = currentUser?.role ?? null
  const email = currentUser?.email ?? user.email ?? null
  const isOwnProfile = user.id === clientUserId
  const hasAdminAccess = isAdmin(role, email)
  if (!isOwnProfile && !hasAdminAccess) {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }

  const validKeys = ['application', 'ace', 'gad', 'phq', 'pcl']
  if (!validKeys.includes(formKey)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid form key. Must be one of: ${validKeys.join(', ')}`,
    })
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: clientUserId, role: 'CLIENT' },
  })
  if (!dbUser) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  if (formKey === 'application') {
    const appForm = await prisma.appForm.findFirst({
      where: { userId: clientUserId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    })
    const q = appForm?.questions
    if (!q) {
      return { formKey: 'application', formName: 'Application', questions: [], submitted: false }
    }
    function formatAppAnswer(val: string | null | undefined): string {
      if (!val || typeof val !== 'string') return ''
      const trimmed = val.trim()
      if (!trimmed) return ''
      try {
        const parsed = JSON.parse(trimmed) as unknown
        if (Array.isArray(parsed)) return parsed.join(', ')
        if (parsed && typeof parsed === 'object') {
          const r = parsed as Record<string, unknown>
          if (Array.isArray(r.values)) {
            const other = typeof r.other === 'string' ? r.other : ''
            return [...r.values, other].filter(Boolean).join(', ')
          }
          if (typeof r.value === 'string') return r.value
          if (typeof r.text === 'string') return r.text
        }
      } catch {
        // Plain text
      }
      return trimmed
    }
    const questions: { label: string; answer: string }[] = []
    for (let i = 1; i <= 50; i++) {
      const key = `q${String(i).padStart(2, '0')}` as keyof typeof q
      const val = q[key]
      const answer = formatAppAnswer(typeof val === 'string' ? val : '')
      questions.push({ label: APP_LABELS[i - 1] ?? `Question ${i}`, answer })
    }
    return {
      formKey: 'application',
      formName: 'Application',
      questions,
      submitted: appForm?.status === 'COMPLETE',
      submittedAt: appForm?.submittedAt,
    }
  }

  if (formKey === 'ace') {
    const aceForm = await prisma.aceForm.findFirst({
      where: { userId: clientUserId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    })

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

    let q = aceForm?.questions ?? null
    if (!q && aceForm) {
      q = await prisma.aceQuestion.findFirst({
        where: { userId: clientUserId },
      })
    }
    if (!q) {
      return {
        formKey: 'ace',
        formName: 'ACE',
        questions: [],
        submitted: aceForm?.status === 'COMPLETE',
        score: aceForm?.totalScore ?? null,
        severity: aceForm?.severity ?? null,
        completedAt: aceForm?.submittedAt,
      }
    }

    const answers = [q.a01, q.a02, q.a03, q.a04, q.a05, q.a06, q.a07, q.a08, q.a09, q.a10]

    const questions = ACE_QUESTIONS_TEXT.map((text, i) => ({
      label: text,
      answer: answers[i] ?? '',
    }))

    return {
      formKey: 'ace',
      formName: 'ACE',
      questions,
      submitted: aceForm?.status === 'COMPLETE',
      completedAt: aceForm?.submittedAt,
      score: aceForm?.totalScore,
      severity: aceForm?.severity,
    }
  }

  if (formKey === 'gad') {
    const gadForm = await prisma.gadForm.findFirst({
      where: { userId: clientUserId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    })
    let q = gadForm?.questions ?? null
    if (!q && gadForm) {
      q =
        (await prisma.gadQuestion.findFirst({ where: { formId: gadForm.id } })) ??
        (await prisma.gadQuestion.findFirst({ where: { userId: clientUserId } }))
    }
    if (!q) {
      return {
        formKey: 'gad',
        formName: 'GAD-7',
        questions: [],
        submitted: gadForm?.status === 'COMPLETE',
        score: gadForm?.totalScore ?? null,
        severity: gadForm?.severity ?? null,
      }
    }
    const answers = [q.g01, q.g02, q.g03, q.g04, q.g05, q.g06, q.g07, q.g08]
    const questions = GAD_LABELS.slice(0, answers.length).map((label, i) => ({
      label,
      answer: answers[i] != null ? (GAD_OPTIONS[answers[i] as number] ?? String(answers[i])) : '',
    }))
    return {
      formKey: 'gad',
      formName: 'GAD-7',
      questions,
      submitted: gadForm?.status === 'COMPLETE',
      score: gadForm?.totalScore,
      severity: gadForm?.severity,
    }
  }

  if (formKey === 'phq') {
    const phqForm = await prisma.phqForm.findFirst({
      where: { userId: clientUserId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    })
    let q = phqForm?.questions ?? null
    if (!q && phqForm) {
      q = await prisma.phqQuestion.findFirst({ where: { formId: phqForm.id } })
    }
    if (!q) {
      return {
        formKey: 'phq',
        formName: 'PHQ-9',
        questions: [],
        submitted: phqForm?.status === 'COMPLETE',
        score: phqForm?.totalScore ?? null,
      }
    }
    const answers = [q.q1, q.q2, q.q3, q.q4, q.q5, q.q6, q.q7, q.q8, q.q9, q.q10]
    const questions = PHQ_LABELS.slice(0, answers.length).map((label, i) => ({
      label,
      answer: answers[i] != null ? (PHQ_OPTIONS[answers[i] as number] ?? String(answers[i])) : '',
    }))
    return {
      formKey: 'phq',
      formName: 'PHQ-9',
      questions,
      submitted: phqForm?.status === 'COMPLETE',
      score: phqForm?.totalScore,
    }
  }

  if (formKey === 'pcl') {
    const pclForm = await prisma.pclForm.findFirst({
      where: { userId: clientUserId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    })
    let q = pclForm?.questions ?? null
    if (!q && pclForm) {
      q =
        (await prisma.pclQuestion.findFirst({ where: { formId: pclForm.id } })) ??
        (await prisma.pclQuestion.findFirst({ where: { userId: clientUserId } }))
    }
    if (!q) {
      return {
        formKey: 'pcl',
        formName: 'PCL-5',
        questions: [],
        submitted: pclForm?.status === 'COMPLETE',
        score: pclForm?.totalScore ?? null,
        severity: pclForm?.severity ?? null,
      }
    }
    const questions: { label: string; answer: string }[] = []
    let totalScore = pclForm?.totalScore ?? null
    if (totalScore == null) {
      totalScore = 0
      for (let i = 1; i <= 20; i++) {
        const key = `q${String(i).padStart(2, '0')}` as keyof typeof q
        const val = q[key]
        totalScore += typeof val === 'number' ? val : 0
      }
    }
    for (let i = 1; i <= 20; i++) {
      const key = `q${String(i).padStart(2, '0')}` as keyof typeof q
      const val = q[key]
      const numVal = typeof val === 'number' ? val : null
      if (numVal != null && numVal >= 0) {
        questions.push({ label: PCL_LABELS[i - 1] ?? `Item ${i}`, answer: String(numVal) })
      }
    }
    let severity = pclForm?.severity ?? null
    if (!severity && totalScore > 0) {
      if (totalScore > 60) severity = 'Severe'
      else if (totalScore > 40) severity = 'Moderate'
      else if (totalScore > 20) severity = 'Mild'
      else severity = 'Minimal'
    }
    return {
      formKey: 'pcl',
      formName: 'PCL-5',
      questions,
      submitted: pclForm?.status === 'COMPLETE',
      submittedAt: pclForm?.submittedAt,
      score: pclForm?.status === 'COMPLETE' ? totalScore : null,
      severity,
    }
  }

  throw createError({ statusCode: 400, statusMessage: 'Invalid form key' })
})
