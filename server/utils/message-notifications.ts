import { emailUsers, getAdminUserIds, notifyAdmins, notifyUser } from './notifications'

const TITLE = 'New message'
const NOTICE = 'You have a new message.'

/**
 * Tells every admin that a client sent a message.
 * The message text is not accepted here, so it cannot land in a notification or an email.
 */
export async function notifyAdminsOfClientMessage(): Promise<void> {
  try {
    await notifyAdmins({
      type: 'MESSAGE_RECEIVED',
      title: TITLE,
      message: NOTICE,
    })
    await emailUsers(await getAdminUserIds(), {
      subject: TITLE,
      intro: NOTICE,
      closing: 'Sign in to the portal to read it.',
    })
  } catch (err) {
    console.error('[messages] admin notification failed', err)
  }
}

/**
 * Tells the client that an admin sent a message.
 * The message text is not accepted here, so it cannot land in a notification or an email.
 */
export async function notifyClientOfAdminMessage(clientUserId: string): Promise<void> {
  try {
    await notifyUser({
      userId: clientUserId,
      type: 'MESSAGE_RECEIVED',
      title: TITLE,
      message: NOTICE,
    })
    await emailUsers([clientUserId], {
      subject: TITLE,
      intro: NOTICE,
      closing: 'Sign in to the portal to read it.',
    })
  } catch (err) {
    console.error('[messages] client notification failed', err)
  }
}
