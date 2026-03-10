<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui'

const props = defineProps<{
  modelValue: string
  contentType?: 'html' | 'markdown' | 'json' 
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const localContent = ref(props.modelValue)
const editor = ref<any>(null)

watch(() => props.modelValue, (newVal) => {
  localContent.value = newVal
})

watch(localContent, (newVal) => {
  emit('update:modelValue', newVal)
}, { deep: true })

// Font size dropdown
const fontSizes = ['Small', 'Normal', 'Large', 'Huge']
const selectedSize = ref('Normal')

const sizeClassMap: Record<string, string> = {
  Small: 'text-sm',
  Normal: 'text-base',
  Large: 'text-lg',
  Huge: 'text-2xl',
}

const items: EditorToolbarItem[][] = [
  [{ slot: 'fontSize' }],
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
  ]
]
</script>

<template>
  <div class="flex h-full w-full min-h-[300px] flex-col border rounded-xl overflow-hidden bg-white dark:bg-gray-900">
    <!-- Editor -->
    <UEditor
    v-slot="{ editor }"  
    v-model="localContent"
      :content-type="contentType || 'markdown'"
      placeholder="Start typing your clinical notes here..."
      class="flex-1 prose prose-sm sm:prose text-left dark:prose-invert"
      :class="sizeClassMap[selectedSize]"
    >
      <UEditorToolbar
        :editor="editor"
        :items="items"
        layout="fixed"
        class="w-full border-b bg-gray-50 dark:bg-gray-800"
      >
      <!-- Font size dropdown inside the toolbar -->
        <template v-slot:["fontSize"]>
          <USelect
            v-model="selectedSize"
            :items="fontSizes"
            size="xs"
            class="w-28"
          />
        </template>
      </UEditorToolbar>
    </UEditor>
  </div>
</template>