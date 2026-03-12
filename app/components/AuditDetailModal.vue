<script setup lang="ts">
interface AuditRecord {
  id: string
  entityType: string
  entityId: string
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  reasoning: string | null
  hasDocumentation: boolean
  documentationName: string | null
  documentationPath: string | null
  signedAt: string
  signedBy: { id: string; name: string; email: string }
}

const props = defineProps<{
  open: boolean
  audit: AuditRecord | null
}>()

const emit = defineEmits<{
  close: []
}>()

const signatureLoading = ref(false)
const signatureData = ref<string | null>(null)
const showDocumentViewer = ref(false)
const documentLoading = ref(false)
const documentError = ref<string | null>(null)

watch(
  () => props.open,
  async (open) => {
    if (open && props.audit) {
      await loadSignature()
    } else {
      signatureData.value = null
      showDocumentViewer.value = false
      documentError.value = null
    }
  }
)

async function loadSignature() {
  if (!props.audit) return
  signatureLoading.value = true
  try {
    const res = await $fetch<{ signatureData: string }>(`/api/audits/${props.audit.id}/signature`)
    signatureData.value = res.signatureData
  } catch {
    signatureData.value = null
  } finally {
    signatureLoading.value = false
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

function formatEntityType(type: string): string {
  const map: Record<string, string> = {
    ABSENCE: 'Absence Update',
    TREATMENT_PLAN: 'Treatment Plan Change',
  }
  return map[type] || type
}

function getDocumentUrl(): string {
  if (!props.audit) return ''
  // Use direct URL if available (stored as full URL in database)
  if (props.audit.documentationPath) {
    return props.audit.documentationPath
  }
  // Fallback to API endpoint
  return `/api/audit-docs/${props.audit.id}`
}

function viewDocumentInline() {
  documentError.value = null
  showDocumentViewer.value = true
}

function openInNewTab() {
  if (props.audit) {
    const url = getDocumentUrl()
    window.open(url, '_blank')
  }
}

function downloadDocument() {
  if (props.audit) {
    // Use API endpoint for download (forces Content-Disposition: attachment)
    window.open(`/api/audit-docs/${props.audit.id}/download`, '_blank')
  }
}

function onIframeError() {
  documentError.value = 'Failed to load document. Try opening in a new tab or downloading.'
}

function isPdf(): boolean {
  const name = props.audit?.documentationName?.toLowerCase() || ''
  return name.endsWith('.pdf')
}

function formatValue(val: Record<string, unknown> | null): string {
  if (!val) return 'N/A'
  return JSON.stringify(val, null, 2)
}
</script>

<template>
  <UModal
    :open="open"
    title="Audit Details"
    :ui="{
      content: 'max-w-4xl w-full',
      body: 'max-h-[85vh] overflow-y-auto p-6',
    }"
    @update:open="(v: boolean) => !v && emit('close')"
  >
    <template #body>
      <div v-if="!audit" class="py-8 text-center text-gray-500">No audit selected.</div>
      <div v-else class="space-y-6">
        <!-- Header Info -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Change Type</p>
            <p class="mt-1 text-sm text-gray-900 dark:text-white">
              {{ formatEntityType(audit.entityType) }}
            </p>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Date & Time</p>
            <p class="mt-1 text-sm text-gray-900 dark:text-white">
              {{ formatDate(audit.signedAt) }}
            </p>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Signed By</p>
            <p class="mt-1 text-sm text-gray-900 dark:text-white">
              {{ audit.signedBy.name }} ({{ audit.signedBy.email }})
            </p>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Entity ID</p>
            <p class="mt-1 text-sm text-gray-900 dark:text-white font-mono text-xs">
              {{ audit.entityId }}
            </p>
          </div>
        </div>

        <!-- Changes -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Previous Value</p>
            <pre
              class="mt-1 rounded-md bg-gray-100 p-2 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200 overflow-x-auto"
            >{{ formatValue(audit.oldValue) }}</pre>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">New Value</p>
            <pre
              class="mt-1 rounded-md bg-gray-100 p-2 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200 overflow-x-auto"
            >{{ formatValue(audit.newValue) }}</pre>
          </div>
        </div>

        <!-- Reasoning -->
        <div v-if="audit.reasoning">
          <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Reasoning</p>
          <p
            class="mt-1 rounded-md bg-blue-50 p-3 text-sm text-gray-700 dark:bg-blue-900/20 dark:text-gray-300"
          >
            {{ audit.reasoning }}
          </p>
        </div>

        <!-- Documentation -->
        <div v-if="audit.hasDocumentation">
          <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Documentation</p>
          <div
            class="mt-1 flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
          >
            <UIcon name="i-heroicons-document" class="h-6 w-6 text-gray-500" />
            <span class="flex-1 text-sm text-gray-700 dark:text-gray-300">
              {{ audit.documentationName || 'Document' }}
            </span>
            <UButton
              v-if="isPdf()"
              variant="outline"
              size="xs"
              icon="i-heroicons-eye"
              @click="viewDocumentInline"
            >
              View
            </UButton>
            <UButton
              variant="outline"
              size="xs"
              icon="i-heroicons-arrow-top-right-on-square"
              @click="openInNewTab"
            >
              Open
            </UButton>
            <UButton
              variant="outline"
              size="xs"
              icon="i-heroicons-arrow-down-tray"
              @click="downloadDocument"
            >
              Download
            </UButton>
          </div>

          <!-- Embedded Document Viewer -->
          <div v-if="showDocumentViewer && isPdf()" class="mt-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Document Preview</span>
              <UButton variant="ghost" size="xs" icon="i-heroicons-x-mark" @click="showDocumentViewer = false">
                Close Preview
              </UButton>
            </div>
            <div
              class="relative rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden"
              style="height: 400px;"
            >
              <iframe
                v-if="!documentError"
                :src="getDocumentUrl()"
                class="w-full h-full"
                @error="onIframeError"
              />
              <div v-if="documentError" class="flex flex-col items-center justify-center h-full text-center p-4">
                <UIcon name="i-heroicons-exclamation-triangle" class="h-10 w-10 text-amber-500 mb-3" />
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{{ documentError }}</p>
                <div class="flex gap-2">
                  <UButton size="sm" variant="outline" @click="openInNewTab">Open in New Tab</UButton>
                  <UButton size="sm" @click="downloadDocument">Download</UButton>
                </div>
              </div>
            </div>
          </div>

          <!-- Non-PDF notice -->
          <p v-if="!isPdf()" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Word documents cannot be previewed. Use "Open" or "Download" to view the file.
          </p>
        </div>

        <!-- Signature -->
        <div>
          <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Admin Signature</p>
          <div
            class="mt-1 flex h-32 items-center justify-center rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
          >
            <USkeleton v-if="signatureLoading" class="h-24 w-64" />
            <img
              v-else-if="signatureData"
              :src="signatureData"
              alt="Admin Signature"
              class="max-h-28 max-w-full"
            />
            <p v-else class="text-sm text-gray-400">Unable to load signature</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end">
          <UButton variant="ghost" @click="emit('close')">Close</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
