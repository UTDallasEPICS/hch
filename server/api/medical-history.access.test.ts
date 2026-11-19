import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'

const state = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  body: {} as Record<string, unknown>,
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    getRouterParam: vi.fn((_event: unknown, name: string) => state.params[name]),
    readBody: vi.fn(async () => state.body),
  }
})

vi.mock('../utils/prisma', () => {
  const model = () => ({
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  })
  return {
    prisma: {
      client: { findUnique: vi.fn(), create: vi.fn() },
      medicationHistory: model(),
      traumaHistory: model(),
    },
  }
})

import { prisma } from '../utils/prisma'
import medicationList from './client/medication-history/index.get'
import medicationCreate from './client/medication-history/index.post'
import medicationUpdate from './client/medication-history/[id].patch'
import medicationDelete from './client/medication-history/[id].delete'
import staffMedicationGet from './clients/[id]/medication-history.get'
import traumaList from './client/trauma-history/index.get'
import traumaCreate from './client/trauma-history/index.post'
import traumaUpdate from './client/trauma-history/[id].patch'
import traumaDelete from './client/trauma-history/[id].delete'
import staffTraumaGet from './clients/[id]/trauma-history.get'

type Mock = ReturnType<typeof vi.fn>
type Handler = (event: H3Event) => Promise<unknown>
type ModelMock = Record<'findMany' | 'findFirst' | 'create' | 'update' | 'deleteMany', Mock>

const clientFindUnique = prisma.client.findUnique as unknown as Mock
const clientCreate = prisma.client.create as unknown as Mock

function makeEvent(opts: { userId: string; role: 'ADMIN' | 'CLINICIAN' | 'CLIENT' }): H3Event {
  return {
    context: {
      user: { id: opts.userId, role: opts.role },
      isAdmin: opts.role === 'ADMIN',
      isClinician: opts.role === 'CLINICIAN',
      isStaff: opts.role === 'ADMIN' || opts.role === 'CLINICIAN',
    },
  } as unknown as H3Event
}

const clientA = () => makeEvent({ userId: 'user-A', role: 'CLIENT' })

const resources = [
  {
    label: 'medication history',
    model: prisma.medicationHistory as unknown as ModelMock,
    list: medicationList as Handler,
    create: medicationCreate as Handler,
    update: medicationUpdate as Handler,
    remove: medicationDelete as Handler,
    staffGet: staffMedicationGet as Handler,
    validBody: { name: 'Sertraline', dosage: '50 mg', frequency: 'Daily', startDate: '2026-01-01' },
    patchBody: { dosage: '100 mg' },
    invalidBody: { name: 'Sertraline', dosage: '', frequency: 'Daily', startDate: '2026-01-01' },
    stored: {
      id: 'rec-1',
      name: 'Sertraline',
      dosage: '50 mg',
      frequency: 'Daily',
      prescriber: null,
      startDate: new Date('2026-01-01'),
      endDate: null,
      notes: null,
    },
  },
  {
    label: 'trauma history',
    model: prisma.traumaHistory as unknown as ModelMock,
    list: traumaList as Handler,
    create: traumaCreate as Handler,
    update: traumaUpdate as Handler,
    remove: traumaDelete as Handler,
    staffGet: staffTraumaGet as Handler,
    validBody: { category: 'Accident', description: 'Car crash' },
    patchBody: { category: 'Loss' },
    invalidBody: { category: 'Accident', description: 'x', approximateDate: '2999-01-01' },
    stored: {
      id: 'rec-1',
      category: 'Accident',
      description: 'Car crash',
      approximateDate: null,
    },
  },
]

beforeEach(() => {
  state.params = {}
  state.body = {}
  clientFindUnique.mockReset()
  clientCreate.mockReset()
  for (const r of resources) {
    for (const fn of Object.values(r.model)) fn.mockReset()
  }
})

describe.each(resources)('$label', (r) => {
  describe('client routes', () => {
    beforeEach(() => {
      // user-A owns Client row client-A.
      clientFindUnique.mockResolvedValue({ id: 'client-A' })
    })

    it("lists only the logged-in client's records", async () => {
      r.model.findMany.mockResolvedValue([r.stored])
      await expect(r.list(clientA())).resolves.toEqual([r.stored])
      expect(clientFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-A' } })
      )
      expect(r.model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clientId: 'client-A' } })
      )
    })

    it('creates a record under the logged-in client, ignoring any clientId in the body', async () => {
      state.body = { ...r.validBody, clientId: 'client-B', proofPath: '/tmp/x' }
      r.model.create.mockResolvedValue(r.stored)
      await r.create(clientA())
      const { data } = r.model.create.mock.calls[0]![0]
      expect(data.clientId).toBe('client-A')
      expect(data).not.toHaveProperty('proofPath')
    })

    it('never selects the proof fields', async () => {
      r.model.findMany.mockResolvedValue([])
      await r.list(clientA())
      const { select } = r.model.findMany.mock.calls[0]![0]
      expect(select).not.toHaveProperty('proofPath')
      expect(select).not.toHaveProperty('proofName')
    })

    it("updates the client's own record", async () => {
      state.params = { id: 'rec-1' }
      state.body = r.patchBody
      r.model.findFirst.mockResolvedValue(r.stored)
      r.model.update.mockResolvedValue({ ...r.stored, ...r.patchBody })
      await r.update(clientA())
      expect(r.model.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rec-1', clientId: 'client-A' } })
      )
      const { where, data } = r.model.update.mock.calls[0]![0]
      expect(where).toEqual({ id: 'rec-1' })
      expect(data).toMatchObject(r.patchBody)
    })

    it("deletes the client's own record", async () => {
      state.params = { id: 'rec-1' }
      r.model.deleteMany.mockResolvedValue({ count: 1 })
      await expect(r.remove(clientA())).resolves.toEqual({ success: true })
      expect(r.model.deleteMany).toHaveBeenCalledWith({
        where: { id: 'rec-1', clientId: 'client-A' },
      })
    })

    it("returns 404 when updating another client's record", async () => {
      state.params = { id: 'rec-of-B' }
      state.body = r.patchBody
      r.model.findFirst.mockResolvedValue(null)
      await expect(r.update(clientA())).rejects.toMatchObject({ statusCode: 404 })
      expect(r.model.update).not.toHaveBeenCalled()
    })

    it("returns 404 when deleting another client's record", async () => {
      state.params = { id: 'rec-of-B' }
      r.model.deleteMany.mockResolvedValue({ count: 0 })
      await expect(r.remove(clientA())).rejects.toMatchObject({ statusCode: 404 })
    })

    it('returns 400 for invalid input on create', async () => {
      state.body = r.invalidBody
      await expect(r.create(clientA())).rejects.toMatchObject({ statusCode: 400 })
      expect(r.model.create).not.toHaveBeenCalled()
    })

    it('returns 400 for invalid input on update', async () => {
      state.params = { id: 'rec-1' }
      state.body = r.invalidBody
      r.model.findFirst.mockResolvedValue(r.stored)
      await expect(r.update(clientA())).rejects.toMatchObject({ statusCode: 400 })
      expect(r.model.update).not.toHaveBeenCalled()
    })

    describe('when the client has no Client row yet', () => {
      beforeEach(() => {
        clientFindUnique.mockResolvedValue(null)
      })

      it('lists an empty history without creating a row', async () => {
        await expect(r.list(clientA())).resolves.toEqual([])
        expect(clientCreate).not.toHaveBeenCalled()
        expect(r.model.findMany).not.toHaveBeenCalled()
      })

      it('creates the Client row, then the record', async () => {
        state.body = r.validBody
        clientCreate.mockResolvedValue({ id: 'client-new' })
        r.model.create.mockResolvedValue(r.stored)
        await r.create(clientA())
        expect(clientCreate).toHaveBeenCalledWith(
          expect.objectContaining({ data: { userId: 'user-A' } })
        )
        expect(r.model.create.mock.calls[0]![0].data.clientId).toBe('client-new')
      })

      it('does not create a Client row for invalid input', async () => {
        state.body = r.invalidBody
        await expect(r.create(clientA())).rejects.toMatchObject({ statusCode: 400 })
        expect(clientCreate).not.toHaveBeenCalled()
      })

      it('returns 404 on update and delete', async () => {
        state.params = { id: 'rec-1' }
        state.body = r.patchBody
        await expect(r.update(clientA())).rejects.toMatchObject({ statusCode: 404 })
        await expect(r.remove(clientA())).rejects.toMatchObject({ statusCode: 404 })
        expect(clientCreate).not.toHaveBeenCalled()
        expect(r.model.update).not.toHaveBeenCalled()
        expect(r.model.deleteMany).not.toHaveBeenCalled()
      })
    })

    it('does not create a Client row when one already exists', async () => {
      state.body = r.validBody
      r.model.create.mockResolvedValue(r.stored)
      await r.create(clientA())
      expect(clientCreate).not.toHaveBeenCalled()
    })

    it.each(['ADMIN', 'CLINICIAN'] as const)('blocks %s from every client route', async (role) => {
      const event = () => makeEvent({ userId: 'staff-1', role })
      state.params = { id: 'rec-1' }
      state.body = r.validBody
      for (const handler of [r.list, r.create, r.update, r.remove]) {
        await expect(handler(event())).rejects.toMatchObject({ statusCode: 403 })
      }
      expect(clientFindUnique).not.toHaveBeenCalled()
    })
  })

  describe('staff read-only route', () => {
    beforeEach(() => {
      state.params = { id: 'user-A' }
      clientFindUnique.mockResolvedValue({ id: 'client-A', clinicianUserId: 'clinician-A' })
      r.model.findMany.mockResolvedValue([r.stored])
    })

    it('lets the assigned clinician read', async () => {
      const event = makeEvent({ userId: 'clinician-A', role: 'CLINICIAN' })
      await expect(r.staffGet(event)).resolves.toEqual([r.stored])
      expect(r.model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clientId: 'client-A' } })
      )
    })

    it('lets an admin read', async () => {
      const event = makeEvent({ userId: 'admin-1', role: 'ADMIN' })
      await expect(r.staffGet(event)).resolves.toEqual([r.stored])
    })

    it('blocks an unassigned clinician', async () => {
      const event = makeEvent({ userId: 'clinician-B', role: 'CLINICIAN' })
      await expect(r.staffGet(event)).rejects.toMatchObject({ statusCode: 403 })
      expect(r.model.findMany).not.toHaveBeenCalled()
    })

    it('blocks a client, even for their own id', async () => {
      await expect(r.staffGet(clientA())).rejects.toMatchObject({ statusCode: 403 })
      expect(r.model.findMany).not.toHaveBeenCalled()
    })

    it('returns 404 when the client does not exist', async () => {
      clientFindUnique.mockResolvedValue(null)
      const event = makeEvent({ userId: 'admin-1', role: 'ADMIN' })
      await expect(r.staffGet(event)).rejects.toMatchObject({ statusCode: 404 })
    })
  })
})
