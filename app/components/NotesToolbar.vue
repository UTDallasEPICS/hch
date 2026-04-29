<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'

const props = defineProps<{
  modelValue: string
  contentType?: 'html' | 'markdown' | 'json'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const localContent = ref(props.modelValue)

const items: EditorToolbarItem[][] = [
  [
    {
      icon: 'i-lucide-heading',
      tooltip: { text: 'Headings' },
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
    { slot: 'taskList' }
  ]
]
</script>

<template>
  <div class="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border bg-white dark:bg-gray-900">
     <!-- Editor -->
    <ClientOnly>
      <UEditor
        v-slot="{ editor }"
        v-model="localContent"
        :content-type="contentType || 'markdown'"
        :extensions="[TaskList, TaskItem.configure({ nested: true })]"
        placeholder="Start typing your clinical notes here..."
        class="flex flex-col flex-1 min-h-0 overflow-hidden"
      >
        <UEditorToolbar
          :editor="editor"
          :items="items"
          layout="fixed"
          class="w-full border-b bg-gray-50 dark:bg-gray-800 shrink-0 z-10 sticky top-0"
          style="min-height: 40px;"
        >
          <template #taskList>
            <button
              type="button"
              class="p-1.5 rounded transition-colors flex items-center justify-center"
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

<style scoped>
/* Improved scrolling + toolbar fix */
:deep(.tiptap.ProseMirror) {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  /* override the *:my-5 spacing that pushes content around */
  margin: 0 !important;
}

/* This targets the direct parent div of ProseMirror inside UEditor */
:deep(div:has(> .tiptap.ProseMirror)) {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}
</style>