<script setup lang="ts">
  definePageMeta({
    // Staff already have /messages. This page is the client's own thread.
    middleware: ['non-admin'],
  })

  const MESSAGE_MAX_LENGTH = 5000
  const POLL_MS = 20_000

  type ThreadMessage = {
    id: string
    senderId: string
    text: string
    sentAt: string
    readAt: string | null
    mine: boolean
  }

  type Thread = {
    conversationId: string | null
    messages: ThreadMessage[]
  }

  const thread = ref<Thread | null>(null)
  const pending = ref(true)
  const loadError = ref('')
  const draft = ref('')
  const sendError = ref('')
  const sending = ref(false)
  const messageList = ref<HTMLElement | null>(null)

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

  async function load(scroll: boolean) {
    const next = await $fetch<Thread>('/api/client/messages')
    const previousCount = thread.value?.messages.length ?? 0
    thread.value = next
    if (scroll || next.messages.length !== previousCount) await scrollToEnd()
  }

  async function send() {
    const text = draft.value.trim()
    if (!text || sending.value) return
    sending.value = true
    sendError.value = ''
    try {
      await $fetch('/api/client/messages', { method: 'POST', body: { text } })
      draft.value = ''
      await load(true)
    } catch (err) {
      sendError.value = errorMessage(err)
    } finally {
      sending.value = false
    }
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null

  onMounted(async () => {
    try {
      await load(true)
    } catch (err) {
      loadError.value = errorMessage(err)
    } finally {
      pending.value = false
    }
    pollTimer = setInterval(() => {
      void load(false).catch(() => {
        // Keep the thread on screen. The next poll can retry.
      })
    }, POLL_MS)
  })

  onBeforeUnmount(() => {
    if (pollTimer) clearInterval(pollTimer)
  })
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Messages</h1>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Your conversation with the clinic.
      </p>
    </div>

    <section
      class="flex min-h-[28rem] flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      <div v-if="pending" class="flex-1 space-y-3 p-4">
        <USkeleton v-for="i in 3" :key="i" class="h-10 w-2/3" />
      </div>
      <p v-else-if="loadError" class="p-4 text-sm text-red-600 dark:text-red-300">
        {{ loadError }}
      </p>
      <div
        v-else
        ref="messageList"
        class="flex max-h-[32rem] flex-1 flex-col gap-3 overflow-y-auto p-4"
      >
        <p
          v-if="!thread || thread.messages.length === 0"
          class="text-sm text-gray-500 dark:text-gray-400"
        >
          No messages yet. Send one to the clinic below.
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

      <form class="border-t border-gray-200 p-4 dark:border-gray-800" @submit.prevent="send">
        <UTextarea
          v-model="draft"
          :maxlength="MESSAGE_MAX_LENGTH"
          :rows="3"
          placeholder="Write a message"
          class="w-full"
        />
        <p v-if="sendError" class="mt-2 text-sm text-red-600 dark:text-red-300">{{ sendError }}</p>
        <div class="mt-3">
          <UButton type="submit" :disabled="!draft.trim() || pending" :loading="sending">
            Send
          </UButton>
        </div>
      </form>
    </section>
  </main>
</template>
