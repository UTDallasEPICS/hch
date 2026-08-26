type ClientStatus = 'Prospective' | 'Waitlist' | 'Active' | 'Archived'

function isRestrictedFormRoute(path: string) {
  return (
    path === '/forms/gad' ||
    path === '/forms/phq' ||
    path === '/forms/pcl' ||
    path === '/forms/physician-statement' ||
    path === '/forms/release-of-information-authorization' ||
    path === '/forms/ace-form' ||
    path === '/forms/ace-form-results'
  )
}

const DOCUMENT_PATHS = new Set([
  '/forms/physician-statement',
  '/forms/release-of-information-authorization',
])

const CLINICAL_ASSESSMENT_PATHS = new Set([
  '/forms/gad',
  '/forms/phq',
  '/forms/pcl',
  '/forms/ace-form',
  '/forms/ace-form-results',
])

export default defineNuxtRouteMiddleware(async (to) => {
  if (!isRestrictedFormRoute(to.path)) return

  try {
    const data = await $fetch<{ status: ClientStatus }>('/api/users/me/client-status')

    // Physician statement & ROI: prospective, waitlist, and active clients may open these pages.
    if (DOCUMENT_PATHS.has(to.path)) {
      if (data.status === 'Prospective' || data.status === 'Waitlist' || data.status === 'Active') {
        return
      }
      return navigateTo('/taskPage')
    }

    // ACE, GAD, PHQ, PCL — waitlist and active clients on the tasks page.
    if (CLINICAL_ASSESSMENT_PATHS.has(to.path)) {
      if (data.status === 'Waitlist' || data.status === 'Active') return
      return navigateTo('/taskPage')
    }

    return navigateTo('/taskPage')
  } catch {
    return navigateTo('/taskPage')
  }
})
