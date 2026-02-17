<script setup lang="ts">
import type { ApplicationForm } from '~/types/application'

defineProps<{
  form: ApplicationForm
  genderOptions: { label: string; value: string }[]
}>()
</script>

<template>
  <div class="space-y-5 [&_label]:block">
    <div>
      <label class="text-sm font-semibold text-gray-200">Where do we send the good stuff?</label>
      <UInput
        v-model="form.q1"
        type="email"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="you@example.com"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">His Name</label>
      <UInput
        v-model="form.q2"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="First name"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">The surname. Don't overthink it.</label>
      <UInput
        v-model="form.q3"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Last name"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Digits we can actually reach you at.</label>
      <UInput
        v-model="form.q5"
        type="tel"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="(555) 000-0000"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">How do you identify?</label>
      <URadioGroup
        v-model="form.q6"
        class="mt-2"
        :options="genderOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q6Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Additional details (optional)"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">When did you enter this chaotic masterpiece?</label>
      <UInput
        v-model="form.q7"
        type="date"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 [color-scheme:dark]"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Where do the snacks get delivered?</label>
      <UTextarea
        v-model="form.q8"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        :rows="3"
        placeholder="Street address, Apt/Unit, City, State, Zip Code"
      />
    </div>
  </div>
</template>
