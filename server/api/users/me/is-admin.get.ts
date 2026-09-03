import { requireUser } from '../../../utils/guard'
import { prisma } from '../../../utils/prisma'
import { isAdmin, isClinician, isStaff } from '../../../utils/is-admin'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, email: true },
  })

  const role = dbUser?.role ?? null

  return {
    isAdmin: isAdmin(role),
    isClinician: isClinician(role),
    isStaff: isStaff(role),
    role,
  }
})
