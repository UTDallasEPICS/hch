<script setup lang="ts">
  import { authClient } from '../utils/auth-client'

  definePageMeta({ middleware: 'admin-only' })

  type Role = 'ADMIN' | 'CLINICIAN' | 'CLIENT'
  type StaffUser = {
    id: string
    name: string
    email: string
    role: Role
    createdAt: string
  }

  const toast = useToast()
  const { data: session } = await authClient.useSession(useFetch)
  const currentUserId = computed(() => (session.value?.user as { id?: string } | null)?.id ?? null)

  const {
    data: users,
    pending,
    error,
    refresh,
  } = await useFetch<StaffUser[]>('/api/staff', {
    getCachedData: () => undefined,
  })

  const roleItems = [
    { label: 'Admin', value: 'ADMIN' },
    { label: 'Clinician', value: 'CLINICIAN' },
    { label: 'Client', value: 'CLIENT' },
  ]

  function roleLabel(role: Role): string {
    return roleItems.find((r) => r.value === role)?.label ?? role
  }

  const savingId = ref<string | null>(null)

  async function changeRole(user: StaffUser, newRole: Role) {
    if (newRole === user.role || savingId.value) return
    savingId.value = user.id
    try {
      await $fetch(`/api/users/${user.id}/role`, {
        method: 'PATCH',
        body: { role: newRole },
      })
      toast.add({
        title: 'Role updated',
        description: `${user.email} is now ${roleLabel(newRole)}.`,
        color: 'success',
      })
      await refresh()
    } catch (e: unknown) {
      const msg =
        (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed to update role'
      toast.add({ title: 'Update failed', description: msg, color: 'error' })
      await refresh()
    } finally {
      savingId.value = null
    }
  }
</script>

<template>
  <UContainer class="max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Staff management</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Grant or revoke admin and clinician access. Every change is recorded.
      </p>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      title="Failed to load users"
      :description="error.statusMessage || 'Please try again.'"
      class="mb-4"
    />

    <div v-if="pending" class="space-y-2">
      <USkeleton v-for="i in 5" :key="i" class="h-12 w-full" />
    </div>

    <div v-else class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table class="w-full text-left text-sm">
        <thead
          class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-gray-900 dark:text-gray-400"
        >
          <tr>
            <th class="px-4 py-3 font-medium">Name</th>
            <th class="px-4 py-3 font-medium">Email</th>
            <th class="w-48 px-4 py-3 font-medium">Role</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
          <tr v-for="user in users ?? []" :key="user.id">
            <td class="px-4 py-3 font-medium">
              {{ user.name || '—' }}
              <UBadge
                v-if="user.id === currentUserId"
                color="neutral"
                variant="soft"
                size="sm"
                class="ml-1"
              >
                You
              </UBadge>
            </td>
            <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ user.email }}</td>
            <td class="px-4 py-3">
              <USelect
                :model-value="user.role"
                :items="roleItems"
                :disabled="user.id === currentUserId || savingId === user.id"
                :loading="savingId === user.id"
                class="w-40"
                @update:model-value="(val: Role) => changeRole(user, val)"
              />
            </td>
          </tr>
          <tr v-if="(users?.length ?? 0) === 0">
            <td colspan="3" class="px-4 py-6 text-center text-gray-500">No users found.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </UContainer>
</template>
