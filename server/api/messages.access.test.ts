import { randomBytes } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { encryptMessage } from '../utils/message-encryption'

process.env.MESSAGE_ENCRYPTION_KEY = randomBytes(32).toString('base64')

const state = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  body: {} as Record<string, unknown>,
  query: {} as Record<string, string>,
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    getRouterParam: vi.fn((_event: unknown, name: string) => state.params[name]),
    readBody: vi.fn(async () => state.body),
    getQuery: vi.fn(() => state.query),
  }
})

vi.mock('../utils/message-notifications', () => ({
  notifyAdminsOfClientMessage: vi.fn(),
  notifyClientOfAdminMessage: vi.fn(),
}))

vi.mock('../utils/prisma', () => {
  const prisma = {
    conversation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    messageAccessLog: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') return arg(prisma)
    return Promise.all(arg as Promise<unknown>[])
  })
  return { prisma }
})

import { prisma } from '../utils/prisma'
import clientGet from './client/messages.get'
import clientPost from './client/messages.post'
import adminList from './admin/messages/index.get'
import adminStart from './admin/messages/index.post'
import adminOpen from './admin/messages/[id].get'
import adminReply from './admin/messages/[id].post'

const conversationFindUnique = prisma.conversation.findUnique as unknown as ReturnType<typeof vi.fn>
const conversationFindMany = prisma.conversation.findMany as unknown as ReturnType<typeof vi.fn>
const conversationUpsert = prisma.conversation.upsert as unknown as ReturnType<typeof vi.fn>
const messageFindMany = prisma.message.findMany as unknown as ReturnType<typeof vi.fn>
const messageCreate = prisma.message.create as unknown as ReturnType<typeof vi.fn>
const messageUpdateMany = prisma.message.updateMany as unknown as ReturnType<typeof vi.fn>
const accessLogCreate = prisma.messageAccessLog.create as unknown as ReturnType<typeof vi.fn>
const userFindUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>

const PLAINTEXT = 'Please call me about tomorrow.'

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

function savedCiphertext(): string {
  const call = messageCreate.mock.calls.at(-1)?.[0] as { data: { ciphertext: string } }
  return call.data.ciphertext
}

beforeEach(() => {
  state.params = { id: 'conv-1' }
  state.body = {}
  state.query = {}
  vi.clearAllMocks()
  prisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') return arg(prisma)
    return Promise.all(arg as Promise<unknown>[])
  })
  conversationUpsert.mockResolvedValue({ id: 'conv-1', clientUserId: 'client-1' })
  conversationFindUnique.mockResolvedValue({
    id: 'conv-1',
    clientUserId: 'client-1',
    client: { id: 'client-1', name: 'Ada||Lovelace', email: 'ada@example.com' },
  })
  messageUpdateMany.mockResolvedValue({ count: 0 })
  messageFindMany.mockResolvedValue([])
  messageCreate.mockImplementation(
    async ({
      data,
    }: {
      data: { sentAt: Date; ciphertext: string; conversationId: string; senderId: string }
    }) => ({
      id: 'msg-1',
      readAt: null,
      ...data,
    })
  )
  accessLogCreate.mockResolvedValue({ id: 'log-1' })
  userFindUnique.mockResolvedValue({ id: 'client-1', role: 'CLIENT' })
})

describe('a client cannot read another client conversation', () => {
  it('loads only the signed-in client conversation', async () => {
    conversationFindUnique.mockImplementation(
      async ({ where }: { where: { clientUserId: string } }) => {
        if (where.clientUserId !== 'client-A') return null
        return { id: 'conv-A', clientUserId: 'client-A' }
      }
    )
    messageFindMany.mockResolvedValue([
      {
        id: 'msg-A',
        senderId: 'client-A',
        ciphertext: encryptMessage(PLAINTEXT),
        sentAt: new Date('2026-10-01T00:00:00.000Z'),
        readAt: null,
      },
    ])

    const result = await clientGet(makeEvent({ userId: 'client-A', role: 'CLIENT' }))

    expect(conversationFindUnique).toHaveBeenCalledWith({ where: { clientUserId: 'client-A' } })
    expect(messageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { conversationId: 'conv-A' } })
    )
    expect(result.messages).toEqual([expect.objectContaining({ text: PLAINTEXT, mine: true })])
  })

  it('gets 403 on the admin conversation route', async () => {
    state.params = { id: 'conv-B' }
    await expect(
      adminOpen(makeEvent({ userId: 'client-A', role: 'CLIENT' }))
    ).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(conversationFindUnique).not.toHaveBeenCalled()
  })
})

describe('a clinician gets 403 on every message route', () => {
  const clinician = () => makeEvent({ userId: 'clinician-1', role: 'CLINICIAN' })

  it('blocks the client routes', async () => {
    await expect(clientGet(clinician())).rejects.toMatchObject({ statusCode: 403 })
    await expect(clientPost(clinician())).rejects.toMatchObject({ statusCode: 403 })
  })

  it('blocks the admin routes', async () => {
    await expect(adminList(clinician())).rejects.toMatchObject({ statusCode: 403 })
    await expect(adminStart(clinician())).rejects.toMatchObject({ statusCode: 403 })
    await expect(adminOpen(clinician())).rejects.toMatchObject({ statusCode: 403 })
    await expect(adminReply(clinician())).rejects.toMatchObject({ statusCode: 403 })
    expect(conversationFindMany).not.toHaveBeenCalled()
    expect(messageCreate).not.toHaveBeenCalled()
  })
})

describe('an admin can read and reply', () => {
  const admin = () => makeEvent({ userId: 'admin-1', role: 'ADMIN' })

  it('lists the inbox with the client unread count', async () => {
    conversationFindMany.mockResolvedValue([
      {
        id: 'conv-1',
        clientUserId: 'client-1',
        lastMessageAt: new Date('2026-10-01T00:00:00.000Z'),
        client: { name: 'Ada||Lovelace', email: 'ada@example.com' },
        messages: [{ senderId: 'client-1' }, { senderId: 'admin-1' }],
      },
    ])

    const result = await adminList(admin())

    expect(result).toEqual([
      expect.objectContaining({
        id: 'conv-1',
        clientName: 'Ada Lovelace',
        unreadCount: 1,
      }),
    ])
  })

  it('opens a conversation with the text decrypted', async () => {
    messageFindMany.mockResolvedValue([
      {
        id: 'msg-1',
        senderId: 'client-1',
        ciphertext: encryptMessage(PLAINTEXT),
        sentAt: new Date('2026-10-01T00:00:00.000Z'),
        readAt: null,
      },
    ])

    const result = await adminOpen(admin())

    expect(result.messages[0]).toEqual(expect.objectContaining({ text: PLAINTEXT, mine: false }))
  })

  it('saves a reply', async () => {
    state.body = { text: PLAINTEXT }

    const result = await adminReply(admin())

    expect(result).toEqual(expect.objectContaining({ text: PLAINTEXT, mine: true }))
    expect(savedCiphertext()).not.toContain(PLAINTEXT)
  })
})

describe('saved text is encrypted', () => {
  it('stores ciphertext for a client send', async () => {
    state.body = { text: PLAINTEXT }

    await clientPost(makeEvent({ userId: 'client-1', role: 'CLIENT' }))

    const stored = savedCiphertext()
    expect(stored).not.toContain(PLAINTEXT)
    expect(stored.startsWith('v1:')).toBe(true)
  })
})

describe('opening a conversation writes an access log', () => {
  it('records the admin, the conversation, and the time', async () => {
    await adminOpen(makeEvent({ userId: 'admin-1', role: 'ADMIN' }))

    expect(accessLogCreate).toHaveBeenCalledTimes(1)
    const saved = accessLogCreate.mock.calls[0][0].data
    expect(saved).toEqual(
      expect.objectContaining({
        adminUserId: 'admin-1',
        conversationId: 'conv-1',
      })
    )
    expect(saved).not.toHaveProperty('ciphertext')
    expect(JSON.stringify(saved)).not.toContain(PLAINTEXT)
  })

  it('does not write a log when the page is only polling', async () => {
    state.query = { recordAccess: '0' }

    await adminOpen(makeEvent({ userId: 'admin-1', role: 'ADMIN' }))

    expect(accessLogCreate).not.toHaveBeenCalled()
    expect(messageUpdateMany).toHaveBeenCalled()
  })
})

describe('empty and over-limit messages are rejected', () => {
  const tooLong = 'a'.repeat(5001)

  it('rejects them on the client send route', async () => {
    const event = makeEvent({ userId: 'client-1', role: 'CLIENT' })
    for (const text of ['', '   ', tooLong]) {
      state.body = { text }
      await expect(clientPost(event)).rejects.toMatchObject({ statusCode: 400 })
    }
    expect(messageCreate).not.toHaveBeenCalled()
  })

  it('rejects them on the admin reply route', async () => {
    const event = makeEvent({ userId: 'admin-1', role: 'ADMIN' })
    for (const text of ['', '   ', tooLong]) {
      state.body = { text }
      await expect(adminReply(event)).rejects.toMatchObject({ statusCode: 400 })
    }
    expect(messageCreate).not.toHaveBeenCalled()
  })

  it('rejects them on the admin start route', async () => {
    const event = makeEvent({ userId: 'admin-1', role: 'ADMIN' })
    for (const text of ['', '   ', tooLong]) {
      state.body = { clientUserId: 'client-1', text }
      await expect(adminStart(event)).rejects.toMatchObject({ statusCode: 400 })
    }
    expect(messageCreate).not.toHaveBeenCalled()
  })
})
