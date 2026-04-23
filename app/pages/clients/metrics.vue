<script setup lang="ts">
  definePageMeta({ middleware: 'clients-admin' })

  type MetricsSegment = {
    label: string
    value: number
    color: string
  }

  type MonthlyBarDatum = {
    month: string
    applied: number
    served: number
  }

  const {
    data: metrics,
    pending,
    error,
  } = await useFetch<{
    year: number
    totalClients: number
    monthlyProgramFlow: MonthlyBarDatum[]
    charts: {
      key: string
      title: string
      responseCount: number
      segments: MetricsSegment[]
    }[]
  }>('/api/clients/metrics', {
    key: 'client-metrics',
    getCachedData: () => undefined,
  })

  const clientCount = computed(() => metrics.value?.totalClients ?? 0)
  const metricsYear = computed(() => metrics.value?.year ?? new Date().getFullYear())
  const monthlyProgramFlow = computed(() => metrics.value?.monthlyProgramFlow ?? [])
  const charts = computed(() => metrics.value?.charts ?? [])
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <NuxtLink
          to="/clients"
          class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <UIcon name="i-heroicons-arrow-left" class="h-4 w-4" />
          Back to Clients
        </NuxtLink>
        <h1
          class="mt-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white"
        >
          Client Metrics
        </h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          View total statistics of clients of the program.
        </p>
      </div>
    </div>

    <UAlert
      v-if="error"
      icon="i-heroicons-exclamation-triangle-20-solid"
      color="error"
      variant="subtle"
      title="Error loading client metrics"
      :description="error.message"
    />

    <template v-else>
      <div v-if="pending" class="mt-6 space-y-6">
        <USkeleton class="h-36 rounded-xl" />
        <USkeleton class="h-[28rem] rounded-xl" />
        <USkeleton class="h-[32rem] rounded-xl" />
        <USkeleton class="h-[32rem] rounded-xl" />
      </div>

      <UAlert
        v-else-if="!clientCount"
        class="mt-6"
        icon="i-heroicons-information-circle-20-solid"
        color="neutral"
        variant="subtle"
        title="No clients available"
        description="Client metrics will appear here once client records exist."
      />

      <section
        v-else
        class="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div class="mb-5 flex items-center gap-2">
          <UIcon name="i-heroicons-chart-bar" class="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">Program totals</h2>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article
            class="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800"
          >
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total clients (waitlist and active)
            </p>
            <div class="mt-3 flex items-end gap-2">
              <span class="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
                {{ clientCount }}
              </span>
              <span class="text-sm text-gray-600 dark:text-gray-300">clients</span>
            </div>
          </article>
        </div>
      </section>

      <ApplicationMetricsMonthlyBarChart
        v-if="monthlyProgramFlow.length"
        class="mt-6"
        title="People Applied vs People Served"
        :year="metricsYear"
        :data="monthlyProgramFlow"
      />

      <div v-if="charts.length" class="mt-6 space-y-6">
        <ApplicationMetricsPieChart
          v-for="chart in charts"
          :key="chart.key"
          :title="chart.title"
          :response-count="chart.responseCount"
          :segments="chart.segments"
        />
      </div>
    </template>
  </main>
</template>
