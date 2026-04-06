import { prisma } from './prisma'

export async function getClientPermissions(userId: string): Promise<{
  canViewScores: boolean
  canViewNotes: boolean
  canViewPlan: boolean
}> {
  const client = await prisma.client.findUnique({
    where: { userId },
    include: { permissions: true },
  })
  if (!client?.permissions) {
    return { canViewScores: false, canViewNotes: false, canViewPlan: false }
  }
  return {
    canViewScores: client.permissions.canViewScores,
    canViewNotes: client.permissions.canViewNotes,
    canViewPlan: client.permissions.canViewPlan,
  }
}
