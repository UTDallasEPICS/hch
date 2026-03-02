import { createError, defineEventHandler, getHeaders, getRouterParam } from 'h3'
import { auth } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'
import { isAdmin } from '../../../../utils/is-admin'
import { getAceFormQuestions } from '../../../../utils/ace-questions'

const GAD_LABELS = [
  'Feeling nervous, anxious or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  'Being so restless that it\'s hard to sit still',
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

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const clientUserId = getRouterParam(event, 'id')
  const formKey = getRouterParam(event, 'formKey')
  if (!clientUserId || !formKey) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id or form key' })
  }

  // Allow admin to view any client's form answers, or client to view their own
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, email: true },
  })
  const role = currentUser?.role ?? null
  const email = currentUser?.email ?? (session.user as { email?: string }).email ?? null
  const isOwnProfile = session.user.id === clientUserId
  const hasAdminAccess = isAdmin(role, email)
  if (!isOwnProfile && !hasAdminAccess) {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }

  const validKeys = ['application', 'ace', 'gad', 'phq', 'pcl']
  if (!validKeys.includes(formKey)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid form key. Must be one of: ${validKeys.join(', ')}` })
  }

  const user = await prisma.user.findFirst({
    where: { id: clientUserId, role: 'CLIENT' },
  })
  if (!user) {
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
      if (answer) {
        questions.push({ label: `Question ${i}`, answer })
      }
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
    const aceResponse = await prisma.aceResponse.findFirst({
      where: { userId: clientUserId },
      orderBy: { completedAt: 'desc' },
    })
    const aceQuestions = getAceFormQuestions()
    const responses = aceResponse ? (JSON.parse(aceResponse.responses) as Record<string, string>) : {}
    const questions = aceQuestions.map((q) => ({
      label: q.text,
      answer: responses[q.alias] ?? '',
    }))
    const score = Object.values(responses).filter((v) => v === 'Yes' || v === 'true').length
    const severity =
      score === 0 ? 'No reported ACEs' : score <= 3 ? 'Intermediate risk' : 'High risk'
    return {
      formKey: 'ace',
      formName: 'ACE',
      questions,
      submitted: !!aceResponse?.responses,
      completedAt: aceResponse?.completedAt,
      score,
      severity,
    }
  }

  if (formKey === 'gad') {
    const gadForm = await prisma.gadForm.findFirst({
      where: { userId: clientUserId },
      orderBy: { id: 'desc' },
      include: { questions: true },
    })
    const q = gadForm?.questions
    if (!q) {
      return { formKey: 'gad', formName: 'GAD-7', questions: [], submitted: false, score: null, severity: null }
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
    const q = phqForm?.questions
    if (!q) {
      return { formKey: 'phq', formName: 'PHQ-9', questions: [], submitted: false, score: null }
    }
    const answers = [
      q.q1, q.q2, q.q3, q.q4, q.q5, q.q6, q.q7, q.q8, q.q9, q.q10,
    ]
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
    const q = pclForm?.questions
    if (!q) {
      return { formKey: 'pcl', formName: 'PCL-5', questions: [], submitted: false, score: null, severity: null }
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
        questions.push({ label: `Item ${i}`, answer: String(numVal) })
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
