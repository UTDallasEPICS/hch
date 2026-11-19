<script setup lang="ts">
  definePageMeta({
    middleware: ['admin-only'],
  })

  const MESSAGE_MAX_LENGTH = 5000
  const POLL_MS = 20_000

  type InboxItem = {
    id: string
    clientUserId: string
    clientName: string
    clientEmail: string
    lastMessageAt: string | null
    unreadCount: number
  }

  type ThreadMessage = {
    id: string
    senderId: string
    text: string
    sentAt: string
    readAt: string | null
    mine: boolean
  }

  type Thread = {
    conversationId: string
    client: { id: string; name: string; email: string }
    messages: ThreadMessage[]
  }

  type ClientRow = {
    id: string
    fname: string
    lname: string
    email: string
    status: string
  }

  const {
    data: inbox,
    pending: inboxPending,
    error: inboxError,
    refresh: refreshInbox,
  } = await useFetch<InboxItem[]>('/api/admin/messages')

  const selectedId = ref<string | null>(null)
  const thread = ref<Thread | null>(null)
  const threadPending = ref(false)
  const threadError = ref('')
  const replyText = ref('')
  const replyError = ref('')
  const sendingReply = ref(false)

  const showStart = ref(false)
  const clients = ref<ClientRow[]>([])
  const clientsPending = ref(false)
  const selectedClientId = ref<string | undefined>(undefined)
  const startText = ref('')
  const startError = ref('')
  const sendingStart = ref(false)

  const messageList = ref<HTMLElement | null>(null)

  const clientOptions = computed(() =>
    clients.value
      .filter((client) => client.status !== 'Archived')
      .map((client) => ({
        label: [client.fname, client.lname].filter(Boolean).join(' ') || client.email,
        value: client.id,
      }))
  )

  function errorMessage(err: unknown): string {
    if (err && typeof err === 'object' && 'data' in err) {
      const data = (err as { data?: { statusMessage?: string; message?: string } }).data
      if (data?.statusMessage) return data.statusMessage
      if (data?.message) return data.message
    }
    return 'Something went wrong. Try again.'
  }

  function formatWhen(iso: string | null): string {
    if (!iso) return ''
    return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  }

  async function scrollToEnd() {
    await nextTick()
    const list = messageList.value
    if (list) list.scrollTop = list.scrollHeight
  }

  async function loadThread(id: string, recordAccess: boolean) {
    const query = recordAccess ? '' : '?recordAccess=0'
    const next = await $fetch<Thread>(`/api/admin/messages/${id}${query}`)
    if (selectedId.value !== id) return
    const previousCount = thread.value?.conversationId === id ? thread.value.messages.length : 0
    thread.value = next
    if (next.messages.length !== previousCount) await scrollToEnd()
  }

  async function openConversation(id: string) {
    selectedId.value = id
    thread.value = null
    threadError.value = ''
    replyError.value = ''
    threadPending.value = true
    try {
      await loadThread(id, true)
      await refreshInbox()
    } catch (err) {
      threadError.value = errorMessage(err)
    } finally {
      threadPending.value = false
    }
  }

  async function sendReply() {
    const text = replyText.value.trim()
    if (!text || !selectedId.value || sendingReply.value) return
    sendingReply.value = true
    replyError.value = ''
    try {
      await $fetch(`/api/admin/messages/${selectedId.value}`, {
        method: 'POST',
        body: { text },
      })
      replyText.value = ''
      await loadThread(selectedId.value, false)
      await refreshInbox()
    } catch (err) {
      replyError.value = errorMessage(err)
    } finally {
      sendingReply.value = false
    }
  }

  async function openStart() {
    showStart.value = !showStart.value
    startError.value = ''
    if (!showStart.value || clients.value.length > 0) return
    clientsPending.value = true
    try {
      clients.value = await $fetch<ClientRow[]>('/api/clients')
    } catch (err) {
      startError.value = errorMessage(err)
    } finally {
      clientsPending.value = false
    }
  }

  async function sendStart() {
    const text = startText.value.trim()
    if (!selectedClientId.value || !text || sendingStart.value) return
    sendingStart.value = true
    startError.value = ''
    try {
      const created = await $fetch<{ conversationId: string }>('/api/admin/messages', {
        method: 'POST',
        body: { clientUserId: selectedClientId.value, text },
      })
      startText.value = ''
      showStart.value = false
      await refreshInbox()
      await openConversation(created.conversationId)
    } catch (err) {
      startError.value = errorMessage(err)
    } finally {
      sendingStart.value = false
    }
  }

  async function poll() {
    await refreshInbox()
    if (!selectedId.value || threadPending.value) return
    try {
      await loadThread(selectedId.value, false)
    } catch {
      // Keep the thread on screen. The next poll can retry.
    }
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null
  onMounted(() => {
    pollTimer = setInterval(() => {
      void poll()
    }, POLL_MS)
  })
  onBeforeUnmount(() => {
    if (pollTimer) clearInterval(pollTimer)
  })
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-6 flex items-center justify-between gap-3">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Messages</h1>
      <UButton icon="i-heroicons-pencil-square" @click="openStart">New message</UButton>
    </div>

    <section
      v-if="showStart"
      class="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
        Start a conversation with a client
      </h2>
      <p v-if="clientsPending" class="mt-3 text-sm text-gray-500">Loading clients...</p>
      <div v-else class="mt-3 flex flex-col gap-3">
        <USelectMenu
          v-model="selectedClientId"
          value-key="value"
          :items="clientOptions"
          :search-input="{ placeholder: 'Search clients...' }"
          placeholder="Select a client"
          class="w-full"
        />
        <UTextarea
          v-model="startText"
          :maxlength="MESSAGE_MAX_LENGTH"
          :rows="3"
          placeholder="Write a message"
          class="w-full"
        />
        <p v-if="startError" class="text-sm text-red-600 dark:text-red-300">{{ startError }}</p>
        <div>
          <UButton
            :disabled="!selectedClientId || !startText.trim()"
            :loading="sendingStart"
            @click="sendStart"
          >
            Send
          </UButton>
        </div>
      </div>
    </section>

    <div v-if="inboxPending" class="space-y-3">
      <USkeleton v-for="i in 4" :key="i" class="h-14 w-full" />
    </div>
    <p v-else-if="inboxError" class="text-sm text-red-600 dark:text-red-300">
      Could not load the inbox.
    </p>

    <div v-else class="grid items-start gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
      <aside
        class="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      >
        <p v-if="!inbox || inbox.length === 0" class="p-4 text-sm text-gray-500 dark:text-gray-400">
          No conversations yet.
        </p>
        <ul v-else class="divide-y divide-gray-200 dark:divide-gray-800">
          <li v-for="item in inbox" :key="item.id">
            <button
              type="button"
              class="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
              :class="item.id === selectedId ? 'bg-gray-50 dark:bg-gray-800' : ''"
              @click="openConversation(item.id)"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium">{{ item.clientName }}</span>
                <span class="block truncate text-xs text-gray-500 dark:text-gray-400">
                  {{ formatWhen(item.lastMessageAt) || item.clientEmail }}
                </span>
              </span>
              <UBadge v-if="item.unreadCount > 0" color="primary" variant="solid" size="sm">
                {{ item.unreadCount }}
              </UBadge>
            </button>
          </li>
        </ul>
      </aside>

      <section
        class="flex min-h-[28rem] flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      >
        <div
          v-if="!selectedId"
          class="flex flex-1 items-center justify-center p-8 text-sm text-gray-500 dark:text-gray-400"
        >
          Select a conversation.
        </div>
        <template v-else>
          <header class="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <h2 class="text-sm font-semibold">
              {{ thread?.client.name || 'Conversation' }}
            </h2>
            <p v-if="thread" class="text-xs text-gray-500 dark:text-gray-400">
              {{ thread.client.email }}
            </p>
          </header>

          <div v-if="threadPending" class="flex-1 space-y-3 p-4">
            <USkeleton v-for="i in 3" :key="i" class="h-10 w-2/3" />
          </div>
          <p v-else-if="threadError" class="p-4 text-sm text-red-600 dark:text-red-300">
            {{ threadError }}
          </p>
          <div
            v-else
            ref="messageList"
            class="flex max-h-[32rem] flex-1 flex-col gap-3 overflow-y-auto p-4"
          >
            <p
              v-if="thread && thread.messages.length === 0"
              class="text-sm text-gray-500 dark:text-gray-400"
            >
              No messages yet.
            </p>
            <div
              v-for="message in thread?.messages ?? []"
              :key="message.id"
              class="flex"
              :class="message.mine ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[80%] rounded-lg px-3 py-2 text-sm"
                :class="
                  message.mine
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                "
              >
                <p class="break-words whitespace-pre-wrap">{{ message.text }}</p>
                <p
                  class="mt-1 text-xs"
                  :class="message.mine ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'"
                >
                  {{ formatWhen(message.sentAt) }}
                </p>
              </div>
            </div>
          </div>

          <form
            class="border-t border-gray-200 p-4 dark:border-gray-800"
            @submit.prevent="sendReply"
          >
            <UTextarea
              v-model="replyText"
              :maxlength="MESSAGE_MAX_LENGTH"
              :rows="3"
              placeholder="Write a reply"
              class="w-full"
            />
            <p v-if="replyError" class="mt-2 text-sm text-red-600 dark:text-red-300">
              {{ replyError }}
            </p>
            <div class="mt-3">
              <UButton type="submit" :disabled="!replyText.trim()" :loading="sendingReply">
                Send
              </UButton>
            </div>
          </form>
        </template>
      </section>
    </div>
  </main>
</template>
