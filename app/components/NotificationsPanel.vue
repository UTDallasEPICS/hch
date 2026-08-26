<script setup lang="ts">
  type NotificationType =
    | 'NOTE_READY_FOR_APPROVAL'
    | 'NOTE_FULLY_APPROVED'
    | 'NOTE_EDITED_AFTER_APPROVAL'

  type NotificationItem = {
    id: string
    type: NotificationType
    title: string
    message: string
    sessionNoteId: string | null
    readAt: string | null
    createdAt: string
  }

  type NotificationResponse = {
    unreadCount: number
    items: NotificationItem[]
  }

  const toast = useToast()
  const showOnlyUnread = ref(true)

  const { data, pending, error, refresh } = await useFetch<NotificationResponse>(
    () => `/api/notifications?limit=10${showOnlyUnread.value ? '&unread=true' : ''}`,
    {
      watch: [showOnlyUnread],
      getCachedData: () => undefined,
    }
  )

  const items = computed(() => data.value?.items ?? [])
  const unreadCount = computed(() => data.value?.unreadCount ?? 0)

  function iconFor(type: NotificationType): string {
    switch (type) {
      case 'NOTE_READY_FOR_APPROVAL':
        return 'i-heroicons-clipboard-document-check-20-solid'
      case 'NOTE_FULLY_APPROVED':
        return 'i-heroicons-check-badge-20-solid'
      case 'NOTE_EDITED_AFTER_APPROVAL':
        return 'i-heroicons-pencil-square-20-solid'
      default:
        return 'i-heroicons-bell-20-solid'
    }
  }

  function timeAgo(iso: string): string {
    const then = new Date(iso).getTime()
    if (Number.isNaN(then)) return ''
    const diff = Date.now() - then
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(iso).toLocaleDateString('en-US')
  }

  async function markAsRead(id: string) {
    try {
      await $fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
      await refresh()
    } catch {
      toast.add({
        title: 'Could not mark as read',
        color: 'error',
      })
    }
  }

  async function markAllRead() {
    try {
      await $fetch('/api/notifications/all/read', { method: 'PATCH' })
      await refresh()
    } catch {
      toast.add({
        title: 'Could not mark all as read',
        color: 'error',
      })
    }
  }
</script>

<template>
  <section
    class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">Notifications</h2>
        <UBadge v-if="unreadCount > 0" color="warning" variant="subtle" size="sm">
          {{ unreadCount }} unread
        </UBadge>
      </div>
      <div class="flex items-center gap-2">
        <div
          class="flex gap-1 rounded-lg border border-gray-200 bg-white p-0.5 text-xs font-medium dark:border-gray-700 dark:bg-gray-900"
        >
          <button
            type="button"
            class="rounded-md px-2.5 py-1 transition-colors"
            :class="
              showOnlyUnread
                ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
                : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
            "
            @click="showOnlyUnread = true"
          >
            Unread
          </button>
          <button
            type="button"
            class="rounded-md px-2.5 py-1 transition-colors"
            :class="
              !showOnlyUnread
                ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
                : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
            "
            @click="showOnlyUnread = false"
          >
            All
          </button>
        </div>
        <UButton
          v-if="unreadCount > 0"
          size="xs"
          variant="ghost"
          color="primary"
          label="Mark all read"
          @click="markAllRead"
        />
      </div>
    </div>

    <div v-if="pending" class="mt-4 space-y-2">
      <USkeleton class="h-12 w-full" />
      <USkeleton class="h-12 w-full" />
    </div>

    <UAlert
      v-else-if="error"
      class="mt-4"
      color="error"
      variant="subtle"
      title="Could not load notifications"
    />

    <p v-else-if="!items.length" class="mt-6 text-sm text-gray-500 dark:text-gray-400">
      {{ showOnlyUnread ? "You're all caught up." : 'No notifications yet.' }}
    </p>

    <ul v-else class="mt-4 space-y-2">
      <li
        v-for="n in items"
        :key="n.id"
        class="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40"
        :class="
          !n.readAt
            ? 'border-primary-200 bg-primary-50/50 dark:border-primary-900/60 dark:bg-primary-950/30'
            : ''
        "
      >
        <UIcon :name="iconFor(n.type)" class="text-primary-500 mt-0.5 h-5 w-5" />
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {{ n.title }}
            </p>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ timeAgo(n.createdAt) }}</span>
          </div>
          <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{{ n.message }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <NuxtLink
            v-if="n.type === 'NOTE_READY_FOR_APPROVAL'"
            to="/clients/session-notes-approvals"
            class="text-primary-600 hover:text-primary-700 dark:text-primary-400 text-xs font-medium"
          >
            Review
          </NuxtLink>
          <UButton
            v-if="!n.readAt"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-check-20-solid"
            :aria-label="`Mark ${n.title} as read`"
            @click="markAsRead(n.id)"
          />
        </div>
      </li>
    </ul>
  </section>
</template>
