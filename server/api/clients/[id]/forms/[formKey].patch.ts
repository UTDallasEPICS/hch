import { requireUser } from '../../../../utils/guard'
import { assertStaffCanAccessClient } from '../../../../utils/clinician-access'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { isAdmin } from '../../../../utils/is-admin'

const PHQ_OPTIONS: Record<string, number> = {
  'Not at all': 0,
  'Several days': 1,
  'More than half the days': 2,
  'Nearly every day': 3,
}

const GAD_OPTIONS: Record<string, number> = {
  'Not at all': 0,
  'Several days': 1,
  'More than half the days': 2,
  'Nearly every day': 3,
}

function toInt(val: string, map: Record<string, number>): number | null {
  if (val in map) return map[val]!
  const n = parseInt(val)
  return isNaN(n) ? null : n
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const clientUserId = getRouterParam(event, 'id')
  const formKey = getRouterParam(event, 'formKey')

  if (!clientUserId || !formKey) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id or form key' })
  }

  if (!event.context.isStaff) {
    throw createError({ statusCode: 403, statusMessage: 'Staff only' })
  }
  await assertStaffCanAccessClient(event, clientUserId)

  const body = await readBody<{ answers: { label: string; answer: string }[] }>(event)
  const answers = body?.answers ?? []

  // ── Application ──────────────────────────────────────────
  if (formKey === 'application') {
    const form = await prisma.appForm.findFirst({ where: { userId: clientUserId } })
    if (!form) throw createError({ statusCode: 404, statusMessage: 'Form not found' })
    const data: Record<string, string> = {}
    answers.forEach((a, i) => {
      const key = `q${String(i + 1).padStart(2, '0')}`
      data[key] = a.answer
    })
    await prisma.appQuestion.update({ where: { formId: form.id }, data })
    return { ok: true }
  }

  // ── ACE ──────────────────────────────────────────────────
  if (formKey === 'ace') {
    const form = await prisma.aceForm.findFirst({ where: { userId: clientUserId } })
    if (!form) throw createError({ statusCode: 404, statusMessage: 'Form not found' })
    const keys = ['a01','a02','a03','a04','a05','a06','a07','a08','a09','a10']
    const data: Record<string, string> = {}
    answers.forEach((a, i) => { if (keys[i]) data[keys[i]!] = a.answer })
    await prisma.aceQuestion.update({ where: { formId: form.id }, data })
    return { ok: true }
  }

  // ── GAD-7 ─────────────────────────────────────────────────
  if (formKey === 'gad') {
    const form = await prisma.gadForm.findFirst({ where: { userId: clientUserId }, orderBy: { id: 'desc' } })
    if (!form) throw createError({ statusCode: 404, statusMessage: 'Form not found' })
    const keys = ['g01','g02','g03','g04','g05','g06','g07','g08']
    const data: Record<string, number | null> = {}
    answers.forEach((a, i) => { if (keys[i]) data[keys[i]!] = toInt(a.answer, GAD_OPTIONS) })
    await prisma.gadQuestion.update({ where: { formId: form.id }, data })
    return { ok: true }
  }

  // ── PHQ-9 ─────────────────────────────────────────────────
  if (formKey === 'phq') {
    const form = await prisma.phqForm.findFirst({ where: { userId: clientUserId }, orderBy: { id: 'desc' } })
    if (!form) throw createError({ statusCode: 404, statusMessage: 'Form not found' })
    const keys = ['q1','q2','q3','q4','q5','q6','q7','q8','q9','q10']
    const data: Record<string, number | null> = {}
    answers.forEach((a, i) => { if (keys[i]) data[keys[i]!] = toInt(a.answer, PHQ_OPTIONS) })
    await prisma.phqQuestion.update({ where: { formId: form.id }, data })
    return { ok: true }
  }

  // ── PCL-5 ─────────────────────────────────────────────────
  if (formKey === 'pcl') {
    const form = await prisma.pclForm.findFirst({ where: { userId: clientUserId }, orderBy: { id: 'desc' } })
    if (!form) throw createError({ statusCode: 404, statusMessage: 'Form not found' })
    const data: Record<string, number | null> = {}
    answers.forEach((a, i) => {
      const key = `q${String(i + 1).padStart(2, '0')}`
      data[key] = toInt(a.answer, {})
    })
    await prisma.pclQuestion.update({ where: { formId: form.id }, data })
    return { ok: true }
  }

  throw createError({ statusCode: 400, statusMessage: 'Invalid form key' })
})