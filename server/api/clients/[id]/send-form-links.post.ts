import { requireStaff } from '../../../utils/guard'
import { assertStaffCanAccessClient } from '../../../utils/clinician-access'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { prisma } from '../../../utils/prisma'
import { isClinicalClient } from '../../../utils/is-clinical-client'
import {
  isSendableEmailFormKey,
  resolveClientFormLinkEntries,
  resetClientFormDataForEmail,
} from '../../../utils/client-forms'
import { sendAppEmail, isEmailConfigured } from '../../../utils/mail'
import { formatStoredUserNameInitials } from '../../../utils/name'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default defineEventHandler(async (event) => {
  requireStaff(event)

  if (!isEmailConfigured()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Email is not configured (set EMAIL_USER and EMAIL_PASS)',
    })
  }

  const clientUserId = getRouterParam(event, 'id')
  if (!clientUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }
  await assertStaffCanAccessClient(event, clientUserId)

  const body = await readBody<{ formKeys?: string[] }>(event)
  const formKeys = body?.formKeys
  if (!Array.isArray(formKeys) || formKeys.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'formKeys must be a non-empty array' })
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: clientUserId },
    select: { id: true, role: true, email: true, name: true },
  })

  if (!dbUser || !isClinicalClient(dbUser.role, dbUser.email)) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  if (!dbUser.email?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Client has no email address' })
  }

  const uniqueKeys = [...new Set(formKeys)]
  for (const key of uniqueKeys) {
    if (!isSendableEmailFormKey(key)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Form "${key}" cannot be sent by email (only clinical assessments: ACE, GAD-7, PHQ-9, PCL-5).`,
      })
    }
  }

  for (const key of uniqueKeys) {
    await resetClientFormDataForEmail(prisma, clientUserId, key)
  }

  let entries: { key: string; label: string; href: string }[]
  try {
    entries = await resolveClientFormLinkEntries(prisma, clientUserId, uniqueKeys)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  const initials = formatStoredUserNameInitials(dbUser.name ?? '')
  const greeting = initials ? `Hello ${escapeHtml(initials)},` : 'Hello,'

  const listItems = entries
    .map(
      (e) =>
        `<li><a href="${escapeHtml(e.href)}">${escapeHtml(e.label)}</a></li>`
    )
    .join('\n')

  const html = `
    <p>${greeting}</p>
    <p>Please use the link(s) below to complete your assessment(s) in the HCH portal. Sign in with your email if you are asked to log in.</p>
    <p><strong>Your previous answers for these assessment(s) have been cleared</strong> so you can start fresh.</p>
    <ul>
      ${listItems}
    </ul>
    <p>If you did not expect this message, you can ignore it.</p>
  `

  await sendAppEmail({
    to: dbUser.email.trim(),
    subject: '[HCH] Assessment link update',
    html,
  })

  return { ok: true as const, count: entries.length }
})
