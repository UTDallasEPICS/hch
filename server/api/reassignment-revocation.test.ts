/**
 * #183: regression guard tying REQ-F-05 reassignment to REQ-F-01 access
 * revocation. Drives the real handlers (#181 admin assign, #182 client
 * request) and the real access check against one shared in-memory client row,
 * so a reassignment path that bypassed Client.clinicianUserId would fail here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'

type ClientRow = {
  id: string
  userId: string
  clinicianUserId: string | null
  reassignmentRequestedAt: Date | null
  reassignmentRequestReason: string | null
}

const db = vi.hoisted(() => ({
  client: null as unknown as ClientRow,
  body: {} as Record<string, unknown>,
  params: {} as Record<string, string>,
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    getRouterParam: vi.fn((_event: unknown, name: string) => db.params[name]),
    readBody: vi.fn(async () => db.body),
  }
})

vi.mock('../utils/prisma', () => ({
  prisma: {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { userId?: string } }) =>
        where.userId === db.client.userId
          ? { ...db.client, user: { name: 'Alex Smith', email: 'alex@x.test' } }
          : null
      ),
      update: vi.fn(async ({ data }: { data: Partial<ClientRow> }) => {
        Object.assign(db.client, data)
        return { ...db.client }
      }),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id.startsWith('doc-') ? { role: 'CLINICIAN' } : null
      ),
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === db.client.userId ? { id: db.client.userId, client: { ...db.client } } : null
      ),
    },
    declarationTemplate: {
      findFirst: vi.fn(async () => ({ id: 'template' })),
      create: vi.fn(async () => ({ id: 'template' })),
    },
  },
}))
vi.mock('../utils/notifications', () => ({ notifyAdmins: vi.fn() }))

import { assertCanAccessClient } from '../utils/clinician-access'
import assignClinician from './clients/[id]/clinician.patch'
import requestNewTherapist from './client/reassignment-request.post'
import profileGet from './clients/[id]/profile.get'

const CLIENT_USER = 'alex'

function eventAs(id: string, role: 'ADMIN' | 'CLINICIAN' | 'CLIENT'): H3Event {
  return {
    context: {
      user: { id, role },
      isAdmin: role === 'ADMIN',
      isClinician: role === 'CLINICIAN',
      isStaff: role !== 'CLIENT',
    },
  } as unknown as H3Event
}

async function statusFor(clinicianId: string): Promise<number | 'ok'> {
  try {
    await assertCanAccessClient(eventAs(clinicianId, 'CLINICIAN'), CLIENT_USER)
    return 'ok'
  } catch (e) {
    return (e as { statusCode: number }).statusCode
  }
}

async function adminAssigns(clinicianUserId: string | null) {
  db.params = { id: CLIENT_USER }
  db.body = { clinicianUserId }
  await assignClinician(eventAs('admin', 'ADMIN'))
}

beforeEach(() => {
  vi.clearAllMocks()
  db.client = {
    id: 'client-row',
    userId: CLIENT_USER,
    clinicianUserId: 'doc-old',
    reassignmentRequestedAt: null,
    reassignmentRequestReason: null,
  }
  db.body = {}
  db.params = {}
})

describe('#181 admin reassignment revokes the previous clinician', () => {
  it("old clinician is 403'd on their very next call", async () => {
    expect(await statusFor('doc-old')).toBe('ok')

    await adminAssigns('doc-new')

    expect(await statusFor('doc-old')).toBe(403)
    expect(await statusFor('doc-new')).toBe('ok')
  })

  it('a real PHI route (client profile) also rejects the old clinician', async () => {
    await adminAssigns('doc-new')
    db.params = { id: CLIENT_USER }
    await expect(profileGet(eventAs('doc-old', 'CLINICIAN'))).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('unassigning (clinician left) also revokes access', async () => {
    await adminAssigns(null)
    expect(await statusFor('doc-old')).toBe(403)
  })
})

describe('#182 client-requested reassignment', () => {
  it('old clinician keeps access while the request is pending (no gap in care)', async () => {
    db.body = { reason: 'not the right fit' }
    await requestNewTherapist(eventAs(CLIENT_USER, 'CLIENT'))

    expect(db.client.reassignmentRequestedAt).toBeInstanceOf(Date)
    expect(await statusFor('doc-old')).toBe('ok')
  })

  it("old clinician is 403'd immediately once an admin reassigns", async () => {
    db.body = { reason: 'not the right fit' }
    await requestNewTherapist(eventAs(CLIENT_USER, 'CLIENT'))

    await adminAssigns('doc-new')

    expect(await statusFor('doc-old')).toBe(403)
    expect(await statusFor('doc-new')).toBe('ok')
    expect(db.client.reassignmentRequestedAt).toBeNull()
  })
})
