<script setup lang="ts">
//import type { EditorToolbarItem } from '@nuxt/ui'

type EditorToolbarItem = any;

const props = defineProps<{
  modelValue: string
  contentType?: 'html' | 'markdown' | 'json' 
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const localContent = ref(props.modelValue)
const editor = ref<any>(null)

watch(() => props.modelValue, (newVal: string) => {
  localContent.value = newVal
})

watch(localContent, (newVal: string) => {
  emit('update:modelValue', newVal)
}, { deep: true })

const items: EditorToolbarItem[][] = [
  [
    {
      icon: 'i-lucide-heading',
      tooltip: { text: 'Headings' },
      content: { align: 'start' },
      items: [
        { kind: 'heading', level: 1, icon: 'i-lucide-heading-1', label: 'Heading 1' },
        { kind: 'heading', level: 2, icon: 'i-lucide-heading-2', label: 'Heading 2' },
        { kind: 'heading', level: 3, icon: 'i-lucide-heading-3', label: 'Heading 3' },
      ]
    }
  ],
  [
    { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold', tooltip: { text: 'Bold' } },
    { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic', tooltip: { text: 'Italic' } },
    { kind: 'mark', mark: 'underline', icon: 'i-lucide-underline', tooltip: { text: 'Underline' } },
    { kind: 'mark', mark: 'strike', icon: 'i-lucide-strikethrough', tooltip: { text: 'Strikethrough' } },
  ],
  [
    { kind: 'bulletList', icon: 'i-lucide-list', tooltip: { text: 'Bullet List' } },
    { kind: 'orderedList', icon: 'i-lucide-list-ordered', tooltip: { text: 'Ordered List' } },
    { slot: 'taskList' },
  ]
]
</script>

<template>
  <div class="flex h-full w-full min-h-[300px] flex-col border rounded-xl overflow-hidden bg-white dark:bg-gray-900">
    <!-- Editor -->
    <ClientOnly>
      <UEditor
        v-slot="{ editor }" 
        v-model="localContent"
        :content-type="contentType || 'markdown'"
        placeholder="Start typing your clinical notes here..."
        class="flex flex-col flex-1 min-h-0 prose prose-sm sm:prose text-left dark:prose-invert"
      >
        <UEditorToolbar
          :editor="editor"
          :items="items"
          layout="fixed"
          class="w-full border-b bg-gray-50 dark:bg-gray-800 flex-shrink-0 sticky top-0 z-10"
        >
         <template #taskList>
          <button
            type="button"
            class="p-1.5 rounded transition-colors"
            :class="editor?.isActive('taskList') ? 'bg-gray-200 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-600'"
            title="Checkbox List"
            @click="editor?.chain().focus().toggleTaskList().run()"
          >
            <UIcon name="i-lucide-list-checks" class="w-4 h-4" />
          </button>
        </template>
        </UEditorToolbar>
      </UEditor>
    </ClientOnly>
  </div>
</template>