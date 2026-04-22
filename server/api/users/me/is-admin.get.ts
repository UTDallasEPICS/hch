import { requireUser } from '../../../utils/guard'
import { prisma } from '../../../utils/prisma'
import { isAdmin, isClinician, isGuaranteedAdminEmail, isStaff } from '../../../utils/is-admin'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, email: true },
  })

  if (dbUser?.role !== 'ADMIN' && isGuaranteedAdminEmail(dbUser?.email ?? null)) {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    })
    return { isAdmin: true, isClinician: false, isStaff: true, role: 'ADMIN' }
  }

  const role = dbUser?.role ?? null
  const email = dbUser?.email ?? null

  return {
    isAdmin: isAdmin(role, email),
    isClinician: isClinician(role),
    isStaff: isStaff(role, email),
    role,
  }
})
