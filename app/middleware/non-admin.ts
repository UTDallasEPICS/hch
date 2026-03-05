export default defineNuxtRouteMiddleware(async () => {
  const { data } = await useFetch<{ isAdmin: boolean }>('/api/user/is-admin')
  if (data.value?.isAdmin) {
    return navigateTo('/clients')
  }
})
