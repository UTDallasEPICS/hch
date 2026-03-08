<script setup lang="ts">
import type { ApplicationForm } from '~/types/application'

defineProps<{
  form: ApplicationForm
  yesNoOptions: { label: string; value: string }[]
  supportGroupOptions: { label: string; value: string }[]
  referralOptions: { label: string; value: string }[]
  insuranceOptions: { label: string; value: string }[]
}>()
</script>

<template>
  <div class="space-y-5 [&_label]:block">
    <div>
      <label class="text-sm font-semibold text-gray-200">
        Applying for the Individual Therapy Scholarship?
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
        placeholder="Additional details (optional)"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        Want to join a Support Group waitlist? Pick one if so.
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
        placeholder="Additional details (optional)"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        If you're seeking a therapy scholarship—who is it for?
      </label>
      <UInput
        v-model="form.q49"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Name of person seeking therapy"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        Therapy needs: do you already have a therapist or want a referral?
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
        placeholder="Additional details (optional)"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        Do you have medical insurance that covers mental health?
      </label>
      <URadioGroup
        v-model="form.q51"
        class="mt-2"
        :options="insuranceOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q51Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Additional details (optional)"
      />
    </div>
  </div>
</template>
