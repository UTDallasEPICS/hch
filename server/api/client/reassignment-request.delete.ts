import { defineEventHandler } from 'h3'
import { requireClientUser } from '../../utils/guard'
import { cancelReassignmentRequest } from '../../utils/reassignment-request'

/** #182: client-only, always scoped to the signed-in client's own record. */
export default defineEventHandler(async (event) => {
  const user = requireClientUser(event)
  return cancelReassignmentRequest(user.id)
})
