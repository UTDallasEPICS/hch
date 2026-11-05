import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./notifications', () => ({
  notifyAdmins: vi.fn(),
  notifyUser: vi.fn(),
  getAdminUserIds: vi.fn(async () => ['admin-1']),
  emailUsers: vi.fn(),
}))

import { emailUsers, getAdminUserIds, notifyAdmins, notifyUser } from './notifications'
import { notifyAdminsOfClientMessage, notifyClientOfAdminMessage } from './message-notifications'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('message notifications', () => {
  it('tells every admin with a fixed notice and no message text', async () => {
    await notifyAdminsOfClientMessage()

    expect(notifyAdmins).toHaveBeenCalledWith({
      type: 'MESSAGE_RECEIVED',
      title: 'New message',
      message: 'You have a new message.',
    })
    expect(getAdminUserIds).toHaveBeenCalled()
    expect(emailUsers).toHaveBeenCalledWith(['admin-1'], {
      subject: 'New message',
      intro: 'You have a new message.',
      closing: 'Sign in to the portal to read it.',
    })
  })

  it('tells the client with a fixed notice and no message text', async () => {
    await notifyClientOfAdminMessage('client-1')

    expect(notifyUser).toHaveBeenCalledWith({
      userId: 'client-1',
      type: 'MESSAGE_RECEIVED',
      title: 'New message',
      message: 'You have a new message.',
    })
    expect(emailUsers).toHaveBeenCalledWith(['client-1'], {
      subject: 'New message',
      intro: 'You have a new message.',
      closing: 'Sign in to the portal to read it.',
    })
  })
})
