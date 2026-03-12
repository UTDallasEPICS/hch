<script setup lang="ts">
import type { ApplicationForm } from '~/types/application'

defineProps<{
  form: ApplicationForm
  yesNoOptions: { label: string; value: string }[]
  caregiverOptions: { label: string; value: string }[]
}>()
</script>

<template>
  <div class="space-y-5 [&_label]:block">
    <h3 class="text-base font-semibold text-gray-100 border-b border-gray-600 pb-2 mb-2">
      Legal Mother
    </h3>
    <div>
      <label class="text-sm font-semibold text-gray-200">Legal mother's first name.</label>
      <UInput
        v-model="form.q20"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="First name"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">And the surname.</label>
      <UInput
        v-model="form.q21"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Last name"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Street address.</label>
      <UInput
        v-model="form.q22"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Street address"
      />
    </div>
    <div class="grid gap-4 sm:grid-cols-3">
      <div>
        <label class="text-sm font-semibold text-gray-200">City</label>
        <UInput
          v-model="form.q23"
          class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
          placeholder="City"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">State</label>
        <UInput
          v-model="form.q24"
          class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
          placeholder="State"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">Zip Code</label>
        <UInput
          v-model="form.q25"
          class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
          placeholder="Zip code"
        />
      </div>
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Legal mother's email.</label>
      <UInput
        v-model="form.q26"
        type="email"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="email@example.com"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Occupation.</label>
      <UInput
        v-model="form.q27"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Occupation"
      />
    </div>

    <h3 class="text-base font-semibold text-gray-100 border-b border-gray-600 pb-2 mt-6 mb-2">
      Legal Father
    </h3>
    <div>
      <label class="text-sm font-semibold text-gray-200">Legal father's first name.</label>
      <UInput
        v-model="form.q29"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="First name"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">And the surname.</label>
      <UInput
        v-model="form.q30"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Last name"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Street address.</label>
      <UInput
        v-model="form.q31"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Street address"
      />
    </div>
    <div class="grid gap-4 sm:grid-cols-3">
      <div>
        <label class="text-sm font-semibold text-gray-200">City</label>
        <UInput
          v-model="form.q32"
          class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
          placeholder="City"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">State</label>
        <UInput
          v-model="form.q33"
          class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
          placeholder="State"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">Zip Code</label>
        <UInput
          v-model="form.q34"
          class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
          placeholder="Zip code"
        />
      </div>
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Legal father's email.</label>
      <UInput
        v-model="form.q35"
        type="email"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="email@example.com"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Occupation.</label>
      <UInput
        v-model="form.q36"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Occupation"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Who's the primary caregiver?</label>
      <URadioGroup
        v-model="form.q37"
        class="mt-2"
        :options="caregiverOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q37Other"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Other (please specify)"
      />
    </div>
  </div>
</template>
