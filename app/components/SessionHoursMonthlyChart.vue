<script setup lang="ts">
  type MonthDatum = {
    month: string
    label: string
    hours: number
    clientsServed: number
    partial: boolean
  }

  const props = defineProps<{
    months: MonthDatum[]
  }>()

  const maxHours = computed(() => Math.max(1, ...props.months.map((m) => m.hours)))

  function barHeight(hours: number) {
    return `${Math.max((hours / maxHours.value) * 100, hours > 0 ? 8 : 0)}%`
  }

  function describe(m: MonthDatum) {
    const soFar = m.partial ? ' so far' : ''
    return `${m.label}: ${m.hours} hours, ${m.clientsServed} clients served${soFar}`
  }
</script>

<template>
  <section
    class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
  >
    <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h3 class="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
          Hours delivered by month
        </h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Last 12 months, by session date. Clients served is shown under each month.
        </p>
      </div>
      <div class="flex flex-wrap gap-4 text-sm">
        <div class="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <span class="h-3 w-3 rounded-sm bg-[#3366CC]" />
          Hours
        </div>
        <div class="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <span class="h-3 w-3 rounded-sm bg-[#3366CC] opacity-40" />
          This month (in progress)
        </div>
      </div>
    </div>

    <div class="mt-8 overflow-x-auto">
      <div class="min-w-[760px]">
        <div
          class="flex h-72 items-end gap-4 border-b border-gray-200 px-2 pb-4 dark:border-gray-700"
        >
          <div
            v-for="m in months"
            :key="m.month"
            class="flex min-w-0 flex-1 flex-col items-center gap-3"
            :title="describe(m)"
          >
            <span class="sr-only">{{ describe(m) }}</span>
            <div class="flex h-56 w-full flex-col items-center justify-end" aria-hidden="true">
              <span class="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                {{ m.hours }}
              </span>
              <div
                class="w-8 rounded-t-md bg-[#3366CC] transition-[height]"
                :class="{ 'opacity-40': m.partial }"
                :style="{ height: barHeight(m.hours) }"
              />
            </div>
            <div class="text-center" aria-hidden="true">
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ m.label.split(' ')[0] }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ m.clientsServed }} clients</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
