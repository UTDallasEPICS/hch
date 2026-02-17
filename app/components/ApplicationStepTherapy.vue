<script setup lang="ts">
import type { ApplicationForm } from '~/types/application'

defineProps<{
  form: ApplicationForm
  yesNoOptions: { label: string; value: string }[]
  supportGroupOptions: { label: string; value: string }[]
  referralOptions: { label: string; value: string }[]
}>()
</script>

<template>
  <div class="space-y-5 [&_label]:block">
    <div>
      <label class="text-sm font-semibold text-gray-200">
        47. Are you applying for the Individual Therapy Scholarship?
      </label>
      <URadioGroup
        v-model="form.q47"
        class="mt-2"
        :options="yesNoOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q47Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="We're rooting for you. Literally. This form is long."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        48. Would you like to join a Support Group waitlist? If so, please select one:
      </label>
      <URadioGroup
        v-model="form.q48"
        class="mt-2"
        :options="supportGroupOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q48Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Pick your vibe. We've got options."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        49. If seeking scholarship for individual therapy, who are you seeking therapy scholarship for?
      </label>
      <UInput
        v-model="form.q49"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Your name? Your kid's? The cat? (Kidding. Unless.)"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        50. If seeking scholarship for individual therapy, do you have a therapist or need a referral?
      </label>
      <URadioGroup
        v-model="form.q50"
        class="mt-2"
        :options="referralOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q50Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Already have someone? Need a match? We've got you."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        51. Do you currently have medical insurance that provides mental health coverage?
      </label>
      <URadioGroup
        v-model="form.q51"
        class="mt-2"
        :options="yesNoOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q51Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="The fine print no one reads. We read it so you don't have to."
      />
    </div>
  </div>
</template>
