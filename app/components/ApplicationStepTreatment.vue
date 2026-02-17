<script setup lang="ts">
import type { ApplicationForm } from '~/types/application'

defineProps<{
  form: ApplicationForm
  yesNoOptions: { label: string; value: string }[]
  siblingOptions: { label: string; value: string }[]
}>()
</script>

<template>
  <div class="space-y-5 [&_label]:block">
    <div>
      <label class="text-sm font-semibold text-gray-200">
        If the child has or had siblings—did any witness something scary or traumatic (e.g. seizures, unresponsiveness, or other medical emergencies)?
      </label>
      <URadioGroup
        v-model="form.q38"
        class="mt-2"
        :options="siblingOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q38Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Additional details (optional)"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        Were siblings separated for a long time from a parent or their sibling with cancer?
      </label>
      <URadioGroup
        v-model="form.q39"
        class="mt-2"
        :options="siblingOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q39Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Additional details (optional)"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Who called the shots on medical decisions?</label>
      <UInput
        v-model="form.q40"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Name or relationship"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Who was mostly at the hospital during treatment?</label>
      <UInput
        v-model="form.q41"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Name or relationship"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">How long was the child in treatment?</label>
      <UInput
        v-model="form.q42"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="e.g. 6 months, 1 year"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Any ICU visits?</label>
      <URadioGroup
        v-model="form.q43"
        class="mt-2"
        :options="yesNoOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q43Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Additional details (optional)"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Any extended hospital stays? If so, how long?</label>
      <UInput
        v-model="form.q44"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="e.g. 2 weeks, 1 month"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Did the child have a relapse or secondary cancer?</label>
      <URadioGroup
        v-model="form.q45"
        class="mt-2"
        :options="yesNoOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q45Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Additional details (optional)"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        Did the child with cancer require hospice care or pass away?
      </label>
      <URadioGroup
        v-model="form.q46"
        class="mt-2"
        :options="yesNoOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q46Other"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Other (please specify)"
      />
    </div>
  </div>
</template>
