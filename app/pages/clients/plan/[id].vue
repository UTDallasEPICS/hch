<script setup lang="ts">
  import type { EditorToolbarItem } from '@nuxt/ui'
  import { TextAlign } from '@tiptap/extension-text-align'
  import { capitalizeName } from '~/utils/name'

  definePageMeta({ middleware: 'clients-admin' })

  const route = useRoute()
  const clientId = computed(() => route.params.id as string)

  const {
    data: profile,
    pending,
    error,
    refresh,
  } = await useFetch(
    () => `/api/clients/${clientId.value}/profile`,
    {
      key: `client-profile-plan-${clientId.value}`,
      watch: [clientId],
      getCachedData: () => undefined,
    }
  )

  const planContent = ref('')
  const planSaving = ref(false)
  const toast = useToast()

  // Reset plan when switching to a different patient to avoid showing wrong plan
  watch(clientId, () => { planContent.value = '' })

  watch(
    () => profile.value?.plan?.content,
    (v) => { planContent.value = v ?? '' },
    { immediate: true }
  )

  // Page title shows which patient's plan is open
  useHead({
    title: () =>
      profile.value
        ? `Plan — ${capitalizeName([profile.value.fname, profile.value.lname].filter(Boolean).join(' ') || profile.value.name || '')}`
        : 'Client Plan',
  })

  function displayName() {
    const p = profile.value
    if (!p) return ''
    const raw = p.lname ? `${p.fname} ${p.lname}` : (p.fname || p.name || '')
    return capitalizeName(raw)
  }

  const editorExtensions = [TextAlign.configure({ types: ['heading', 'paragraph'] })]

  const toolbarItems: EditorToolbarItem[][] = [
    [{
      kind: 'undo',
      icon: 'i-lucide-undo',
      tooltip: { text: 'Undo' },
    }, {
      kind: 'redo',
      icon: 'i-lucide-redo',
      tooltip: { text: 'Redo' },
    }],
    [{
      icon: 'i-lucide-heading',
      tooltip: { text: 'Headings' },
      content: { align: 'start' },
      items: [{
        kind: 'heading',
        level: 1,
        icon: 'i-lucide-heading-1',
        label: 'Heading 1',
      }, {
        kind: 'heading',
        level: 2,
        icon: 'i-lucide-heading-2',
        label: 'Heading 2',
      }, {
        kind: 'heading',
        level: 3,
        icon: 'i-lucide-heading-3',
        label: 'Heading 3',
      }, {
        kind: 'heading',
        level: 4,
        icon: 'i-lucide-heading-4',
        label: 'Heading 4',
      }],
    }, {
      kind: 'bulletList',
      icon: 'i-lucide-list',
      tooltip: { text: 'Bullet List' },
    }, {
      kind: 'orderedList',
      icon: 'i-lucide-list-ordered',
      tooltip: { text: 'Ordered List' },
    }, {
      kind: 'textAlign',
      align: 'left',
      icon: 'i-lucide-align-left',
      tooltip: { text: 'Align Left' },
    }, {
      kind: 'textAlign',
      align: 'center',
      icon: 'i-lucide-align-center',
      tooltip: { text: 'Align Center' },
    }, {
      kind: 'textAlign',
      align: 'right',
      icon: 'i-lucide-align-right',
      tooltip: { text: 'Align Right' },
    }, {
      kind: 'textAlign',
      align: 'justify',
      icon: 'i-lucide-align-justify',
      tooltip: { text: 'Align Justify' },
    }],
    [{
      kind: 'mark',
      mark: 'bold',
      icon: 'i-lucide-bold',
      tooltip: { text: 'Bold' },
    }, {
      kind: 'mark',
      mark: 'italic',
      icon: 'i-lucide-italic',
      tooltip: { text: 'Italic' },
    }, {
      kind: 'mark',
      mark: 'underline',
      icon: 'i-lucide-underline',
      tooltip: { text: 'Underline' },
    }, {
      kind: 'mark',
      mark: 'strike',
      icon: 'i-lucide-strikethrough',
      tooltip: { text: 'Strikethrough' },
    }, {
      kind: 'mark',
      mark: 'code',
      icon: 'i-lucide-code',
      tooltip: { text: 'Code' },
    }],
    [{
      kind: 'link',
      icon: 'i-lucide-link',
      tooltip: { text: 'Link' },
    }],
    [{
      icon: 'i-lucide-more-horizontal',
      tooltip: { text: 'More' },
      content: { align: 'end' },
      items: [{
        kind: 'blockquote',
        icon: 'i-lucide-text-quote',
        label: 'Blockquote',
      }, {
        kind: 'codeBlock',
        icon: 'i-lucide-square-code',
        label: 'Code Block',
      }, {
        kind: 'horizontalRule',
        icon: 'i-lucide-separator-horizontal',
        label: 'Horizontal Rule',
      }],
    }],
  ]

  async function savePlan() {
    if (!clientId.value || planSaving.value) return
    try {
      planSaving.value = true
      const res = await $fetch<{ id: string; content: string; createdAt: string; updatedAt: string; clientId: string }>(`/api/clients/${clientId.value}/plan`, {
        method: 'PUT',
        body: { content: planContent.value },
      })
      if (profile.value) {
        profile.value.plan = res
      }
      toast.add({ title: 'Plan updated', color: 'success' })
      await refresh()
    } catch (e: unknown) {
      const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed to update'
      toast.add({ title: 'Error', description: msg, color: 'error' })
    } finally {
      planSaving.value = false
    }
  }
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <NuxtLink
        to="/clients"
        class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <UIcon name="i-heroicons-arrow-left" class="h-4 w-4" />
        Back to Clients
      </NuxtLink>
    </div>

    <div v-if="pending" class="space-y-4">
      <USkeleton class="h-8 w-48" />
      <USkeleton class="h-4 w-32" />
      <USkeleton class="h-64 w-full" />
    </div>

    <UAlert
      v-else-if="error"
      icon="i-heroicons-exclamation-triangle-20-solid"
      color="error"
      variant="subtle"
      title="Error loading plan"
      :description="error.message"
    >
      <template #actions>
        <UButton to="/clients" variant="soft" size="sm">Back to Clients</UButton>
      </template>
    </UAlert>

    <div v-else class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div class="mb-4 rounded-lg border border-primary-200 bg-primary-50/50 px-4 py-2 dark:border-primary-800 dark:bg-primary-900/20">
        <p class="text-xs font-medium text-primary-700 dark:text-primary-400">Patient</p>
        <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ displayName() || 'Unknown' }}</p>
      </div>
      <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
        Treatment Plan
      </h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        This plan is unique to {{ displayName() || 'this patient' }}. Create or edit their treatment plan. Clients can view this if permitted.
      </p>
      <div class="mt-6 flex flex-col gap-4">
        <UEditor
          v-slot="{ editor }"
          v-model="planContent"
          content-type="markdown"
          placeholder="Enter client plan..."
          :extensions="editorExtensions"
          class="flex min-h-[400px] w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30"
          :ui="{ base: 'px-4 sm:px-6 py-5 min-h-[360px]' }"
        >
          <UEditorToolbar
            :editor="editor"
            :items="toolbarItems"
            class="shrink-0 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50 sm:px-6"
          />
        </UEditor>
        <UButton
          size="md"
          color="primary"
          class="mt-4"
          :loading="planSaving"
          @click="savePlan"
        >
          Save Plan
        </UButton>
      </div>
    </div>
  </main>
</template>
