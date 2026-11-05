export default defineNuxtRouteMiddleware(async () => {
  const { data } = await useFetch<{ isStaff: boolean }>('/api/users/me/is-admin')
  if (!data.value?.isStaff) {
    return navigateTo('/')
  }
})
