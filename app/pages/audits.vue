<script setup lang="ts">
definePageMeta({
  middleware: ['auth'],
})

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

const { data: audits, pending, refresh } = await useFetch<AuditRecord[]>('/api/audits')

const selectedAudit = ref<AuditRecord | null>(null)
const detailModalOpen = ref(false)

function openDetail(audit: AuditRecord) {
  selectedAudit.value = audit
  detailModalOpen.value = true
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

function formatEntityType(type: string): string {
  const map: Record<string, string> = {
    ABSENCE: 'Absence',
    TREATMENT_PLAN: 'Treatment Plan',
  }
  return map[type] || type
}

const columns = [
  { key: 'signedAt', label: 'Date' },
  { key: 'entityType', label: 'Type' },
  { key: 'signedBy', label: 'Signed By' },
  { key: 'reasoning', label: 'Reasoning' },
  { key: 'documentation', label: 'Doc' },
  { key: 'actions', label: '' },
]

const tableData = computed(() =>
  (audits.value || []).map((a) => ({
    ...a,
    _signedAtDisplay: formatDate(a.signedAt),
    _entityTypeDisplay: formatEntityType(a.entityType),
    _signedByDisplay: a.signedBy.name,
    _reasoningDisplay: a.reasoning ? (a.reasoning.length > 50 ? a.reasoning.slice(0, 50) + '...' : a.reasoning) : '-',
  }))
)
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Audit History</h1>
      <UButton variant="ghost" icon="i-heroicons-arrow-path" :loading="pending" @click="refresh">
        Refresh
      </UButton>
    </div>

    <div v-if="pending" class="space-y-4">
      <USkeleton v-for="i in 5" :key="i" class="h-12 w-full" />
    </div>

    <div v-else-if="!audits || audits.length === 0" class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800">
      <UIcon name="i-heroicons-document-magnifying-glass" class="mx-auto h-12 w-12 text-gray-400" />
      <p class="mt-4 text-gray-600 dark:text-gray-400">No audit records found.</p>
    </div>

    <UTable v-else :columns="columns" :rows="tableData" class="w-full">
      <template #signedAt-data="{ row }">
        <span class="text-sm">{{ row._signedAtDisplay }}</span>
      </template>
      <template #entityType-data="{ row }">
        <UBadge
          :color="row.entityType === 'ABSENCE' ? 'amber' : 'blue'"
          variant="subtle"
          size="xs"
        >
          {{ row._entityTypeDisplay }}
        </UBadge>
      </template>
      <template #signedBy-data="{ row }">
        <span class="text-sm">{{ row._signedByDisplay }}</span>
      </template>
      <template #reasoning-data="{ row }">
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ row._reasoningDisplay }}</span>
      </template>
      <template #documentation-data="{ row }">
        <UIcon
          v-if="row.hasDocumentation"
          name="i-heroicons-document-check"
          class="h-5 w-5 text-green-500"
        />
        <span v-else class="text-gray-400">-</span>
      </template>
      <template #actions-data="{ row }">
        <UButton variant="ghost" size="xs" icon="i-heroicons-eye" @click="openDetail(row)">
          View
        </UButton>
      </template>
    </UTable>

    <AuditDetailModal
      :open="detailModalOpen"
      :audit="selectedAudit"
      @close="detailModalOpen = false"
    />
  </main>
</template>
