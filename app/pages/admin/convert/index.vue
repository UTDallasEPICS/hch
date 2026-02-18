<script setup lang="ts">
const tab = ref<'file' | 'gdoc'>('file')
const file = ref<File | null>(null)
const docId = ref('')
const loading = ref(false)
const error = ref('')

const router = useRouter()

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
  error.value = ''
}

async function uploadFile() {
  if (!file.value) { error.value = 'Please select a PDF or DOCX file.'; return }
  const allowed = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]
  if (!allowed.includes(file.value.type)) {
    error.value = 'Only PDF and .docx files are supported.'
    return
  }

  loading.value = true
  error.value = ''

  const fd = new FormData()
  fd.append('file', file.value)

  try {
    const res = await $fetch<{ documentId: string }>('/api/convert/upload', {
      method: 'POST',
      body: fd,
    })
    router.push(`/admin/convert/${res.documentId}`)
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? 'Upload failed.'
  } finally {
    loading.value = false
  }
}

async function uploadGdoc() {
  if (!docId.value.trim()) { error.value = 'Please paste a Google Docs URL or document ID.'; return }

  // Accept full URL or bare ID
  const match = docId.value.match(/\/d\/([a-zA-Z0-9_-]+)/)
  const id = match ? match[1] : docId.value.trim()

  loading.value = true
  error.value = ''

  const fd = new FormData()
  fd.append('docId', id)

  try {
    const res = await $fetch<{ documentId: string }>('/api/convert/upload', {
      method: 'POST',
      body: fd,
    })
    router.push(`/admin/convert/${res.documentId}`)
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? 'Could not reach extraction service.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-6">
    <div class="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">

      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Document → Form Converter</h1>
        <p class="mt-1 text-sm text-gray-500">
          Upload a PDF, Word doc, or paste a Google Docs link.
          We'll extract the form fields — you review and save.
        </p>
      </div>

      <!-- Tab switcher -->
      <div class="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
        <button
          class="flex-1 py-2 transition-colors"
          :class="tab === 'file' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'"
          @click="tab = 'file'; error = ''"
        >
          PDF / Word
        </button>
        <button
          class="flex-1 py-2 transition-colors border-l border-gray-200"
          :class="tab === 'gdoc' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'"
          @click="tab = 'gdoc'; error = ''"
        >
          Google Doc
        </button>
      </div>

      <!-- File upload -->
      <div v-if="tab === 'file'" class="space-y-4">
        <label
          class="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
          :class="{ 'border-primary-500 bg-primary-50': file }"
        >
          <div class="flex flex-col items-center gap-2 text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span v-if="!file" class="text-sm">Click to select or drag &amp; drop</span>
            <span v-else class="text-sm font-medium text-primary-700">{{ file.name }}</span>
            <span class="text-xs text-gray-400">PDF or .docx, up to 20 MB</span>
          </div>
          <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            class="hidden" @change="onFileChange" />
        </label>

        <UButton block :loading="loading" :disabled="!file || loading" @click="uploadFile">
          Extract Form Fields
        </UButton>
      </div>

      <!-- Google Docs input -->
      <div v-if="tab === 'gdoc'" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Google Docs URL or Document ID
          </label>
          <input
            v-model="docId"
            type="text"
            placeholder="https://docs.google.com/document/d/…"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p class="mt-1 text-xs text-gray-400">
            The document must be shared with the service account configured in the backend.
          </p>
        </div>

        <UButton block :loading="loading" :disabled="!docId.trim() || loading" @click="uploadGdoc">
          Fetch & Extract
        </UButton>
      </div>

      <!-- Error -->
      <p v-if="error" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {{ error }}
      </p>

    </div>
  </div>
</template>
