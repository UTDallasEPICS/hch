import { defineEventHandler } from 'h3'
import { requireAdmin } from '../../utils/guard'
import { listClientsNeedingReassignment } from '../../utils/reassignment-queue'

/**
 * Admin-only (REQ-F-05c): active clients whose clinician left or who have no
 * clinician, each with top tag-based recommendations. Reassigning goes through
 * PATCH /api/clients/[id]/clinician, which also revokes the old clinician's
 * access (access is derived from Client.clinicianUserId).
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  return listClientsNeedingReassignment()
})
