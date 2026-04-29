<script setup lang="ts">
  type MonthlyBarDatum = {
    month: string
    applied: number
    served: number
  }

  const props = defineProps<{
    title: string
    year: number
    data: MonthlyBarDatum[]
  }>()

  const maxValue = computed(() => {
    const values = props.data.flatMap((row) => [row.applied, row.served])
    return Math.max(1, ...values)
  })

  function barHeight(value: number) {
    return `${Math.max((value / maxValue.value) * 100, value > 0 ? 8 : 0)}%`
  }
</script>

<template>
  <section
    class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
  >
    <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h3 class="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
          {{ title }}
        </h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Monthly totals for {{ year }}.</p>
      </div>
      <div class="flex flex-wrap gap-4 text-sm">
        <div class="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <span class="h-3 w-3 rounded-sm bg-[#3366CC]" />
          People Applied
        </div>
        <div class="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <span class="h-3 w-3 rounded-sm bg-[#DC3912]" />
          People Served
        </div>
      </div>
    </div>

    <div class="mt-8 overflow-x-auto">
      <div class="min-w-[760px]">
        <div
          class="flex h-72 items-end gap-4 border-b border-gray-200 px-2 pb-4 dark:border-gray-700"
        >
          <div
            v-for="row in data"
            :key="row.month"
            class="flex min-w-0 flex-1 flex-col items-center gap-3"
          >
            <div class="flex h-56 w-full items-end justify-center gap-2">
              <div class="flex h-full w-5 flex-col items-center justify-end">
                <span class="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {{ row.applied }}
                </span>
                <div
                  class="w-full rounded-t-md bg-[#3366CC] transition-[height]"
                  :style="{ height: barHeight(row.applied) }"
                />
              </div>
              <div class="flex h-full w-5 flex-col items-center justify-end">
                <span class="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {{ row.served }}
                </span>
                <div
                  class="w-full rounded-t-md bg-[#DC3912] transition-[height]"
                  :style="{ height: barHeight(row.served) }"
                />
              </div>
            </div>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{
              row.month
            }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
