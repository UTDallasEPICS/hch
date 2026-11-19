import { defineEventHandler, readBody } from 'h3'
import { requireClientUser } from '../../../utils/guard'
import { parseTraumaInput, traumaHistorySelect } from '../../../utils/medical-history'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireClientUser(event)

  // Validate before touching the Client row so a bad request doesn't create one.
  const data = parseTraumaInput(await readBody(event))

  // Client rows are created lazily (same as clients/[id]/plan.put.ts), so the
  // client may add history before their row exists.
  let clientRow = await prisma.client.findUnique({
    where: { userId: user.id },
    select: { id: true },
  })
  if (!clientRow) {
    clientRow = await prisma.client.create({
      data: { userId: user.id },
      select: { id: true },
    })
  }

  return prisma.traumaHistory.create({
    data: { ...data, clientId: clientRow.id },
    select: traumaHistorySelect,
  })
})
