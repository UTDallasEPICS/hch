import { requireStaff } from '../../utils/guard'
import { assertStaffCanAccessClient } from '../../utils/clinician-access'
import { prisma } from '../../utils/prisma'
import { createError, defineEventHandler, getHeaders, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing appointment ID',
      })
    }

    const user = requireStaff(event)
    const adminId = user.id

    const existing = await prisma.appointment.findUnique({
      where: { id },
      select: { clientId: true },
    })
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Appointment not found' })
    }
    await assertStaffCanAccessClient(event, existing.clientId)

    await prisma.appointment.delete({
      where: { id },
    })

    return {
      success: true,
    }
  } catch (error: any) {
    if (error?.code === 'P2025') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Appointment not found',
      })
    }

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Delete appointment error:', error)

    // Check if it's a Prisma error
    if (error && typeof error === 'object') {
      const errorObj = error as Record<string, any>
      console.error('Error details:', {
        message: errorObj.message,
        code: errorObj.code,
        meta: errorObj.meta,
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete appointment',
    })
  }
})
