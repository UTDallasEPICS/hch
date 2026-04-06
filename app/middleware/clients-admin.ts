export default defineNuxtRouteMiddleware(async () => {
  const { data } = await useFetch<{ isAdmin: boolean }>('/api/users/me/is-admin')
  if (!data.value?.isAdmin) {
    return navigateTo('/')
  }
})
