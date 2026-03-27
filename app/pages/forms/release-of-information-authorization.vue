<script setup lang="ts">
  definePageMeta({ middleware: 'waitlist-forms' })

  const toast = useToast()
  const selectedFile = ref<File | null>(null)
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const uploading = ref(false)

  function isPdfFile(file: File) {
    const mimeType = file.type?.toLowerCase() || ''
    const fileName = file.name.toLowerCase()
    return mimeType === 'application/pdf' || fileName.endsWith('.pdf')
  }

  const {
    data: progress,
    pending,
    refresh,
  } = await useFetch<{
    submitted: boolean
    uploadedAt: string | null
    originalFileName: string | null
    templateUrl: string
    uploadedFileUrl: string | null
  }>('/api/release-of-information/progress', { getCachedData: () => undefined })

  function onFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) {
      selectedFile.value = null
      return
    }

    if (!isPdfFile(file)) {
      selectedFile.value = null
      target.value = ''
      toast.add({
        title: 'Invalid file',
        description: 'Please choose a PDF file only.',
        color: 'error',
      })
      return
    }

    selectedFile.value = file
  }

  function openFilePicker() {
    fileInputRef.value?.click()
  }

  function clearSelectedFile() {
    selectedFile.value = null
    if (fileInputRef.value) fileInputRef.value.value = ''
  }

  async function uploadFile() {
    if (!selectedFile.value || uploading.value) return

    if (!isPdfFile(selectedFile.value)) {
      toast.add({
        title: 'Invalid file',
        description: 'Please upload a PDF file.',
        color: 'error',
      })
      return
    }

    const formData = new FormData()
    formData.append('file', selectedFile.value)

    try {
      uploading.value = true
      await $fetch('/api/release-of-information/upload', {
        method: 'POST',
        body: formData,
      })
      selectedFile.value = null
      toast.add({
        title: 'Upload complete',
        description: 'Your completed Release of Information Authorization Form has been uploaded.',
        color: 'success',
      })
      await refresh()
    } catch (error: any) {
      const message =
        error?.data?.statusMessage || error?.statusMessage || 'Failed to upload your form'
      toast.add({ title: 'Upload failed', description: message, color: 'error' })
    } finally {
      uploading.value = false
    }
  }
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-8">
      <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
        Release of Information Authorization Form
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Download the template PDF, complete it, and upload the completed form.
      </p>
    </div>

    <div v-if="pending" class="space-y-4">
      <USkeleton class="h-20 w-full rounded-xl" />
      <USkeleton class="h-48 w-full rounded-xl" />
    </div>

    <template v-else>
      <div
        class="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">Step 1: Download</h2>
        <UButton
          :to="progress?.templateUrl || '/release-of-information-authorization-form.pdf'"
          target="_blank"
          rel="noopener noreferrer"
          icon="i-heroicons-arrow-down-tray"
          color="primary"
          variant="soft"
        >
          Download ROI Authorization PDF
        </UButton>
      </div>

      <div
        class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">Step 2: Upload</h2>

        <div class="mb-4">
          <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Upload completed PDF
          </label>
          <input
            ref="fileInputRef"
            type="file"
            accept="application/pdf,.pdf"
            class="hidden"
            @change="onFileChange"
          />
          <div
            class="flex flex-wrap items-center gap-3 rounded-lg border border-gray-300 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-800"
          >
            <UButton
              type="button"
              icon="i-heroicons-paper-clip"
              color="neutral"
              variant="outline"
              @click="openFilePicker"
            >
              Choose PDF
            </UButton>
            <span class="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
              {{ selectedFile ? selectedFile.name : 'No file selected' }}
            </span>
            <UButton
              v-if="selectedFile"
              type="button"
              color="error"
              variant="ghost"
              size="sm"
              icon="i-heroicons-x-mark"
              @click="clearSelectedFile"
            >
              Clear
            </UButton>
          </div>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">PDF only. Max 10MB.</p>
        </div>

        <div class="mb-4 flex flex-wrap items-center gap-3">
          <UButton
            :disabled="!selectedFile || uploading"
            :loading="uploading"
            icon="i-heroicons-arrow-up-tray"
            color="primary"
            @click="uploadFile"
          >
            Upload Completed Form
          </UButton>

          <UButton to="/taskPage" variant="outline" color="neutral">Back to Tasks</UButton>
        </div>

        <UAlert
          v-if="progress?.submitted"
          icon="i-heroicons-check-circle"
          color="success"
          variant="subtle"
          title="Completed form submitted"
          :description="
            progress.uploadedAt
              ? `Submitted ${new Date(progress.uploadedAt).toLocaleString()}`
              : 'Your completed form has been submitted.'
          "
        >
          <template #actions>
            <UButton
              v-if="progress.uploadedFileUrl"
              :to="progress.uploadedFileUrl"
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              variant="soft"
            >
              Download Uploaded Copy
            </UButton>
          </template>
        </UAlert>
      </div>
    </template>
  </main>
</template>
