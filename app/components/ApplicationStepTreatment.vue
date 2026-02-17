<script setup lang="ts">
import type { ApplicationForm } from '~/types/application'

defineProps<{
  form: ApplicationForm
  yesNoOptions: { label: string; value: string }[]
}>()
</script>

<template>
  <div class="space-y-5 [&_label]:block">
    <div>
      <label class="text-sm font-semibold text-gray-200">
        38. If child has/had siblings, did any witness a scary or traumatic event (e.g. seizures,
        unresponsiveness, death or other medical emergencies)?
      </label>
      <URadioGroup
        v-model="form.q38"
        class="mt-2"
        :options="yesNoOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q38Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Only if you want to share. We're here for it."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        39. Were siblings separated for a prolonged period from a parent and their sibling with
        cancer?
      </label>
      <URadioGroup
        v-model="form.q39"
        class="mt-2"
        :options="yesNoOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q39Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Whatever you're comfortable with. No pressure."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">40. Who was responsible for medical decisions?</label>
      <UInput
        v-model="form.q40"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="The decider-in-chief. Could be one person. Could be a committee."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        41. Who was primarily at the hospital during treatment?
      </label>
      <UInput
        v-model="form.q41"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Who was basically living there. We see you."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">42. How long was the child in treatment?</label>
      <UInput
        v-model="form.q42"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Roughly. 'Forever' is also an answer. We get it."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">43. Were there any ICU visits?</label>
      <URadioGroup
        v-model="form.q43"
        class="mt-2"
        :options="yesNoOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q43Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="We know this one's heavy. Take your time."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        44. Were there any extended hospital admissions? If so, how long?
      </label>
      <UInput
        v-model="form.q44"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="A week? A month? The entire MCU phase? We've heard it all."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        45. Did the child have a relapse or secondary cancer?
      </label>
      <URadioGroup
        v-model="form.q45"
        class="mt-2"
        :options="yesNoOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q45Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Whatever you're comfortable sharing."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        46. Did the child with cancer require hospice care and/or pass away?
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
        placeholder="We're really sorry we have to ask. Sending love."
      />
    </div>
  </div>
</template>
