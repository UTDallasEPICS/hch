type ClientStatus = 'Prospective' | 'Waitlist' | 'Active' | 'Archived'

function isWaitlistOnlyRoute(path: string) {
  return (
    path === '/gad' ||
    path === '/phq' ||
    path === '/pcl' ||
    path === '/forms/physician-statement' ||
    path === '/forms/release-of-information-authorization' ||
    path === '/forms/ace-form' ||
    path === '/forms/ace-form-results'
  )
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (!isWaitlistOnlyRoute(to.path)) return

  try {
    const data = await $fetch<{ status: ClientStatus }>('/api/user/client-status')
    const canAccessDocumentTasks =
      (to.path === '/forms/physician-statement' ||
        to.path === '/forms/release-of-information-authorization') &&
      (data.status === 'Prospective' || data.status === 'Waitlist')
    if (!canAccessDocumentTasks && data.status !== 'Waitlist') {
      return navigateTo('/taskPage')
    }
  } catch {
    return navigateTo('/taskPage')
  }
})
