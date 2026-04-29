<script setup lang="ts">
  type ChartSegment = {
    label: string
    value: number
    color: string
  }

  type RenderedSegment = ChartSegment & {
    percent: number
    path: string
    labelX: number
    labelY: number
    showLabel: boolean
    fullCircle: boolean
  }

  const props = defineProps<{
    title: string
    responseCount: number
    segments: ChartSegment[]
  }>()

  const CHART_CENTER = 120
  const CHART_RADIUS = 88
  const LABEL_RADIUS = 64

  const total = computed(() => props.segments.reduce((sum, segment) => sum + segment.value, 0))

  function polarToCartesian(cx: number, cy: number, radius: number, angleDegrees: number) {
    const angleInRadians = ((angleDegrees - 90) * Math.PI) / 180
    return {
      x: cx + radius * Math.cos(angleInRadians),
      y: cy + radius * Math.sin(angleInRadians),
    }
  }

  function describeSlice(startAngle: number, endAngle: number) {
    const start = polarToCartesian(CHART_CENTER, CHART_CENTER, CHART_RADIUS, endAngle)
    const end = polarToCartesian(CHART_CENTER, CHART_CENTER, CHART_RADIUS, startAngle)
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

    return [
      `M ${CHART_CENTER} ${CHART_CENTER}`,
      `L ${start.x} ${start.y}`,
      `A ${CHART_RADIUS} ${CHART_RADIUS} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
      'Z',
    ].join(' ')
  }

  const renderedSegments = computed<RenderedSegment[]>(() => {
    if (!total.value) return []

    let startAngle = 0
    return props.segments
      .filter((segment) => segment.value > 0)
      .map((segment) => {
        const sweepAngle = (segment.value / total.value) * 360
        const endAngle = startAngle + sweepAngle
        const midAngle = startAngle + sweepAngle / 2
        const labelPoint = polarToCartesian(CHART_CENTER, CHART_CENTER, LABEL_RADIUS, midAngle)
        const percent = Math.round((segment.value / total.value) * 100)

        const renderedSegment: RenderedSegment = {
          ...segment,
          percent,
          path: describeSlice(startAngle, endAngle),
          labelX: labelPoint.x,
          labelY: labelPoint.y,
          showLabel: percent >= 8,
          fullCircle: sweepAngle >= 359.9,
        }

        startAngle = endAngle
        return renderedSegment
      })
  })

  const legendSegments = computed(() => props.segments)
</script>

<template>
  <section
    class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
  >
    <h3 class="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
      {{ title }}
    </h3>
    <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">{{ responseCount }} responses</p>

    <div class="mt-6 flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
      <div class="flex justify-center xl:min-w-[22rem]">
        <svg viewBox="0 0 240 240" class="h-[19rem] w-[19rem]">
          <circle cx="120" cy="120" r="88" fill="#e5e7eb" class="dark:fill-gray-700" />

          <template v-for="segment in renderedSegments" :key="segment.label">
            <circle v-if="segment.fullCircle" cx="120" cy="120" r="88" :fill="segment.color" />
            <path v-else :d="segment.path" :fill="segment.color" />
            <text
              v-if="segment.showLabel"
              :x="segment.labelX"
              :y="segment.labelY"
              fill="white"
              font-size="12"
              font-weight="700"
              text-anchor="middle"
              dominant-baseline="middle"
            >
              {{ segment.percent }}%
            </text>
          </template>
        </svg>
      </div>

      <ul class="w-full max-w-xl space-y-4 self-center xl:self-start">
        <li
          v-for="segment in legendSegments"
          :key="`${title}-${segment.label}`"
          class="flex items-start gap-3"
        >
          <span
            class="mt-1 h-4 w-4 shrink-0 rounded-full"
            :style="{ backgroundColor: segment.color }"
          />
          <div>
            <p class="text-base text-gray-900 dark:text-white">{{ segment.label }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ segment.value }} responses</p>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
