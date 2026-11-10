import { defineEventHandler, readBody } from 'h3'
import { requireClientUser } from '../../utils/guard'
import { createReassignmentRequest } from '../../utils/reassignment-request'

/** #182: client-only, always scoped to the signed-in client's own record. */
export default defineEventHandler(async (event) => {
  const user = requireClientUser(event)
  const body = await readBody<{ reason?: unknown }>(event)
  return createReassignmentRequest(user.id, body?.reason)
})
