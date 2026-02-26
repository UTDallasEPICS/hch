<script setup lang="ts">
  import { authClient } from '../utils/auth-client'

  const { data: users, pending, error } = await useFetch('/api/get/users')

  async function logout() {
    await authClient.signOut()
    await navigateTo('/auth', { external: true })
  }
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
          Dashboard
        </h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Manage your application users and settings.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          to="/clients"
          color="primary"
          variant="soft"
          icon="i-heroicons-user-group-20-solid"
          label="Clients"
        />
        <UButton
          color="error"
          variant="soft"
          icon="i-heroicons-arrow-right-on-rectangle-20-solid"
          label="Logout"
          @click="logout"
        />
      </div>
    </div>

    <div
      class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <div class="mb-6 flex items-center justify-between border-b border-gray-200 pb-4 dark:border-gray-800">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-users-20-solid" class="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            Registered Users
          </h2>
        </div>
        <UBadge variant="subtle" color="primary" size="md">{{ users?.length || 0 }} Users</UBadge>
      </div>

      <div v-if="pending" class="space-y-4">
        <div v-for="i in 3" :key="i" class="flex items-center justify-between py-2">
          <div class="flex w-full items-center gap-3">
            <USkeleton class="h-10 w-10 rounded-full" />
            <div class="w-full max-w-[200px] space-y-2">
              <USkeleton class="h-4 w-full" />
              <USkeleton class="h-3 w-2/3" />
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="error">
        <UAlert
          icon="i-heroicons-exclamation-triangle-20-solid"
          color="error"
          variant="subtle"
          title="Error loading users"
          :description="error.message"
        />
      </div>

      <div v-else class="divide-y divide-gray-200 dark:divide-gray-800">
        <div
          v-for="user in users"
          :key="user.id"
          class="flex items-center justify-between py-4 first:pt-0 last:pb-0"
        >
          <div class="flex items-center gap-3">
            <UAvatar :alt="user.name" :src="user.image || undefined" size="md" />
            <div>
              <p class="font-medium text-gray-900 dark:text-white">{{ user.name }}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ user.email }}</p>
            </div>
          </div>
          <UBadge :color="user.emailVerified ? 'success' : 'warning'" variant="subtle" size="sm">
            {{ user.emailVerified ? 'Verified' : 'Pending' }}
          </UBadge>
        </div>

        <div v-if="users?.length === 0" class="py-8 text-center text-gray-500 dark:text-gray-400">
          No users found.
        </div>
      </div>
    </div>
  </main>
</template>
