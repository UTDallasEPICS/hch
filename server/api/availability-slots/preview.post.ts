import { defineEventHandler, readBody } from 'h3'
import { requireStaff } from '../../utils/guard'
import { assertAvailabilityClinicianAccess, parseAvailabilityGenerationRequest } from '../../utils/availability-request'
import { getAvailableAvailabilitySlotCandidates } from '../../utils/availability-slots'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireStaff(event)
  const input = parseAvailabilityGenerationRequest(await readBody(event), user.id)
  await assertAvailabilityClinicianAccess(event, input.clinicianUserId)

  const slots = await getAvailableAvailabilitySlotCandidates(prisma, input)
  return slots.map((slot) => ({
    startTime: slot.startTime,
    endTime: slot.endTime,
  }))
})
