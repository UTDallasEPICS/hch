import { defineEventHandler, readBody } from 'h3'
import { requireStaff } from '../../utils/guard'
import { assertAvailabilityClinicianAccess, parseAvailabilityGenerationRequest } from '../../utils/availability-request'
import { generateAvailabilitySlots } from '../../utils/availability-slots'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireStaff(event)
  const input = parseAvailabilityGenerationRequest(await readBody(event), user.id)
  await assertAvailabilityClinicianAccess(event, input.clinicianUserId)

  const result = await generateAvailabilitySlots(prisma, input)
  return result
})
