import { defineEventHandler } from 'h3'
import { requireClientUser } from '../../utils/guard'
import { getReassignmentRequest } from '../../utils/reassignment-request'

/** #182: client-only, always scoped to the signed-in client's own record. */
export default defineEventHandler(async (event) => {
  const user = requireClientUser(event)
  return getReassignmentRequest(user.id)
})
