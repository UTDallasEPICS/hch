import { requireUser } from '../../../../utils/guard'
import { assertStaffCanAccessClient } from '../../../../utils/clinician-access'
import { createError, defineEventHandler, getHeaders, getRouterParam } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { isAdmin } from '../../../../utils/is-admin'
import { loadClinicalFormQuestions } from '../../../../utils/clinical-form-display'

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
  const isClinicianViewer = !hasAdminAccess && event.context.isClinician === true
  if (!isOwnProfile && !hasAdminAccess && !isClinicianViewer) {
    throw createError({ statusCode: 403, statusMessage: 'Staff only' })
  }
  if (isClinicianViewer && !isOwnProfile) {
    await assertStaffCanAccessClient(event, clientUserId)
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
        if (Array.isArray(parsed)) {
          return parsed.map((item: unknown) => {
            if (item && typeof item === 'object') {
              const r = item as Record<string, unknown>
              if (typeof r.firstName === 'string') {
                return [r.firstName, r.middleInitial, r.lastName, r.age ? `(age ${r.age})` : '', r.relationship].filter(Boolean).join(' ')
              }
              return Object.values(r).filter(Boolean).join(' ')
            }
            return String(item)
          }).join(', ')
        }
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
    const questions = await loadClinicalFormQuestions(prisma, clientUserId, 'ace')
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
    const questions = await loadClinicalFormQuestions(prisma, clientUserId, 'gad')
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
    const questions = await loadClinicalFormQuestions(prisma, clientUserId, 'phq')
    return {
      formKey: 'phq',
      formName: 'PHQ-9',
      questions,
      submitted: phqForm?.status === 'COMPLETE',
      score: phqForm?.totalScore,
      severity: phqForm?.severity,
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
    const questions = await loadClinicalFormQuestions(prisma, clientUserId, 'pcl')
    let totalScore = pclForm?.totalScore ?? null
    if (q && totalScore == null) {
      totalScore = 0
      for (let i = 1; i <= 20; i++) {
        const key = `q${String(i).padStart(2, '0')}` as keyof typeof q
        const val = q[key]
        totalScore += typeof val === 'number' ? val : 0
      }
    }
    let severity = pclForm?.severity ?? null
    if (!severity && totalScore != null && totalScore > 0) {
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
