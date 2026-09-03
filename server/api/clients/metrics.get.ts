import { defineEventHandler } from 'h3'
import { requireAdmin } from '../../utils/guard'
import { isClinicalClient } from '../../utils/is-clinical-client'
import { prisma } from '../../utils/prisma'

const PIE_COLORS = [
  '#3366CC',
  '#DC3912',
  '#FF9900',
  '#109618',
  '#990099',
  '#0099C6',
  '#DD4477',
  '#66AA00',
  '#B82E2E',
  '#316395',
]

type CompletedApplicationRow = {
  q05: string | null
  q16: string | null
  q37: string | null
  q38: string | null
  q42: string | null
  q44: string | null
  q45: string | null
  q47: string | null
  q49: string | null
  q50: string | null
}

type ChartOption = {
  value: string
  label: string
}

type ChartDefinition = {
  key: string
  title: string
  options: ChartOption[]
  readValues: (row: CompletedApplicationRow) => string[]
}

type MonthlyBarDatum = {
  month: string
  applied: number
  served: number
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function humanizeValue(value: string): string {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function parseChoiceValue(raw: string | null | undefined): string {
  const trimmed = cleanString(raw)
  if (!trimmed) return ''

  try {
    const parsed = JSON.parse(trimmed) as unknown

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>
      const value = cleanString(record.value)
      if (value) return value
    }
  } catch {
    return trimmed
  }

  return trimmed
}

function parseChoiceArray(raw: string | null | undefined): string[] {
  const trimmed = cleanString(raw)
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed) as unknown

    if (Array.isArray(parsed)) {
      return parsed.map((value) => cleanString(value)).filter(Boolean)
    }

    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>
      if (Array.isArray(record.values)) {
        return record.values.map((value) => cleanString(value)).filter(Boolean)
      }
    }
  } catch {
    return [trimmed]
  }

  return []
}

function normalizeToKnownOption(value: string, options: ChartOption[]): string | null {
  const trimmed = cleanString(value)
  if (!trimmed) return null

  const exactMatch = options.find((option) => option.value === trimmed)
  if (exactMatch) return exactMatch.value

  const lower = trimmed.toLowerCase()
  const caseInsensitiveValueMatch = options.find((option) => option.value.toLowerCase() === lower)
  if (caseInsensitiveValueMatch) return caseInsensitiveValueMatch.value

  const caseInsensitiveLabelMatch = options.find((option) => option.label.toLowerCase() === lower)
  if (caseInsensitiveLabelMatch) return caseInsensitiveLabelMatch.value

  return null
}

function incrementMonthCount(counts: number[], date: Date | null | undefined) {
  if (!date || Number.isNaN(date.getTime())) return
  counts[date.getMonth()] = (counts[date.getMonth()] ?? 0) + 1
}

function buildMonthlyProgramFlow(
  year: number,
  applicationDates: Date[],
  servedDates: Date[]
): MonthlyBarDatum[] {
  const appliedCounts = Array.from({ length: 12 }, () => 0)
  const servedCounts = Array.from({ length: 12 }, () => 0)

  for (const date of applicationDates) {
    if (date.getFullYear() === year) incrementMonthCount(appliedCounts, date)
  }

  for (const date of servedDates) {
    if (date.getFullYear() === year) incrementMonthCount(servedCounts, date)
  }

  return Array.from({ length: 12 }, (_, index) => ({
    month: new Date(year, index, 1).toLocaleString('en-US', { month: 'short' }),
    applied: appliedCounts[index] ?? 0,
    served: servedCounts[index] ?? 0,
  }))
}

const CHART_DEFINITIONS: ChartDefinition[] = [
  {
    key: 'gender-q5',
    title: 'Gender',
    options: [
      { value: 'Male', label: 'Male' },
      { value: 'Female', label: 'Female' },
      { value: 'Other', label: 'Other' },
      { value: 'Prefer not to say', label: 'Prefer not to say' },
    ],
    readValues: (row) => {
      const value = cleanString(row.q05)
      return value ? [value] : []
    },
  },
  {
    key: 'biological-parents-q16',
    title: 'Does child reside with both biological parents?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
      { value: 'other', label: 'Other' },
    ],
    readValues: (row) => {
      const value = parseChoiceValue(row.q16)
      return value ? [value] : []
    },
  },
  {
    key: 'siblings-trauma-q37',
    title: 'If child has or had siblings, did any siblings witness a scary or traumatic event?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
      { value: 'not_applicable', label: 'Not Applicable' },
    ],
    readValues: (row) => {
      const value = cleanString(row.q37)
      return value ? [value] : []
    },
  },
  {
    key: 'siblings-separated-q38',
    title:
      'Were siblings separated for a prolonged period from a parent and their sibling with cancer?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
      { value: 'not_applicable', label: 'Not Applicable' },
    ],
    readValues: (row) => {
      const value = cleanString(row.q38)
      return value ? [value] : []
    },
  },
  {
    key: 'icu-visits-q42',
    title: 'Were there any ICU visits?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
    readValues: (row) => {
      const value = cleanString(row.q42)
      return value ? [value] : []
    },
  },
  {
    key: 'relapse-q44',
    title: 'Did your child have a relapse or secondary cancer?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
    readValues: (row) => {
      const value = cleanString(row.q44)
      return value ? [value] : []
    },
  },
  {
    key: 'hospice-q45',
    title: 'Did your child with cancer require hospice care and/or pass away?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
      { value: 'other', label: 'Other' },
    ],
    readValues: (row) => {
      const value = parseChoiceValue(row.q45)
      return value ? [value] : []
    },
  },
  {
    key: 'support-group-waitlist',
    title: 'Would you like to join a Support Group waitlist? If so, please select one:',
    options: [
      { value: 'parent', label: 'Parent' },
      {
        value: 'adolescent_child_diagnosed_with_cancer',
        label: 'Adolescent - Child Diagnosed with Cancer',
      },
      { value: 'adolescent_sibling', label: 'Adolescent - Sibling' },
      { value: 'grandparent', label: 'Grandparent' },
      { value: 'other', label: 'Other' },
    ],
    readValues: (row) => parseChoiceArray(row.q47),
  },
  {
    key: 'therapy-referral',
    title:
      'If you are seeking scholarship for individual therapy, do you have a therapist or need a referral?',
    options: [
      { value: 'have_therapist', label: 'I Have a therapist already' },
      {
        value: 'need_referral',
        label: 'I DO NOT have a therapist and would like a referral',
      },
    ],
    readValues: (row) => {
      const value = cleanString(row.q49)
      return value ? [value] : []
    },
  },
  {
    key: 'insurance-coverage',
    title: 'Do you currently have a medical insurance that provides mental health coverage?',
    options: [
      {
        value: 'yes_with_mental_health_benefits',
        label: 'Yes, I have insurance with mental health benefits.',
      },
      { value: 'no', label: 'No' },
    ],
    readValues: (row) => {
      const value = cleanString(row.q50)
      return value ? [value] : []
    },
  },
]

function buildChart(definition: ChartDefinition, rows: CompletedApplicationRow[]) {
  const counts = new Map<string, number>()
  for (const option of definition.options) {
    counts.set(option.value, 0)
  }

  let responseCount = 0

  for (const row of rows) {
    const values = definition
      .readValues(row)
      .map((value) => normalizeToKnownOption(value, definition.options))
      .filter((value): value is string => Boolean(value))
    if (!values.length) continue

    responseCount += 1
    for (const value of values) {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }

  const knownSegments = definition.options.map((option, index) => ({
    label: option.label,
    value: counts.get(option.value) ?? 0,
    color: PIE_COLORS[index % PIE_COLORS.length],
  }))

  return {
    key: definition.key,
    title: definition.title,
    responseCount,
    segments: knownSegments,
  }
}

export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const year = new Date().getFullYear()

  const [users, applicationForms, waitlistedClients] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'CLIENT' },
      select: {
        id: true,
        role: true,
        email: true,
        client: {
          select: {
            status: true,
          },
        },
      },
    }),
    prisma.appForm.findMany({
      where: { status: 'COMPLETE' },
      select: {
        userId: true,
        submittedAt: true,
        questions: {
          select: {
            q05: true,
            q16: true,
            q37: true,
            q38: true,
            q42: true,
            q44: true,
            q45: true,
            q47: true,
            q49: true,
            q50: true,
          },
        },
      },
    }),
    prisma.$queryRaw<Array<{ userId: string; waitlistedAt: Date | string | null }>>`
      SELECT userId, waitlistedAt
      FROM client
      WHERE waitlistedAt IS NOT NULL
    `,
  ])

  const eligibleClientIds = new Set(
    users
      .filter(
        (user) =>
          isClinicalClient(user.role) &&
          (user.client?.status === 'WAITLIST' || user.client?.status === 'ACTIVE')
      )
      .map((user) => user.id)
  )

  const completedRows = applicationForms
    .filter((form) => eligibleClientIds.has(form.userId) && form.questions)
    .map((form) => form.questions as CompletedApplicationRow)

  const allClinicalClientIds = new Set(
    users.filter((user) => isClinicalClient(user.role)).map((user) => user.id)
  )

  const applicationDates = applicationForms
    .filter((form) => allClinicalClientIds.has(form.userId) && form.submittedAt)
    .map((form) => form.submittedAt as Date)

  const servedDates = waitlistedClients
    .filter((client) => allClinicalClientIds.has(client.userId) && client.waitlistedAt)
    .map((client) => new Date(client.waitlistedAt as Date | string))

  return {
    year,
    totalClients: eligibleClientIds.size,
    monthlyProgramFlow: buildMonthlyProgramFlow(year, applicationDates, servedDates),
    charts: CHART_DEFINITIONS.map((definition) => buildChart(definition, completedRows)),
  }
})
