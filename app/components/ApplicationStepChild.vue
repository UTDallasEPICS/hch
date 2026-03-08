<script setup lang="ts">
import type { ApplicationForm } from '~/types/application'

defineProps<{
  form: ApplicationForm
  genderOptions: { label: string; value: string }[]
  yesNoOptions: { label: string; value: string }[]
  custodyOptions: { label: string; value: string }[]
}>()
</script>

<template>
  <div class="space-y-5 [&_label]:block">
    <div>
      <label class="text-sm font-semibold text-gray-200">The tiny human's first name.</label>
      <UInput
        v-model="form.q9"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Child's first name"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">And the last name. We're thorough.</label>
      <UInput
        v-model="form.q10"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Child's last name"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">When did they enter this chaotic masterpiece?</label>
      <UInput
        v-model="form.q11"
        type="date"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 [color-scheme:dark]"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">How does the child identify?</label>
      <URadioGroup
        v-model="form.q12"
        class="mt-2"
        :options="genderOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q12Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Additional details (optional)"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Child's address—same as yours or different?</label>
      <UTextarea
        v-model="form.q13"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        :rows="3"
        placeholder="Street address, City, State, Zip"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Give it to us straight—what are we dealing with?</label>
      <UInput
        v-model="form.q14"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="e.g. type of cancer or condition"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Date of diagnosis.</label>
      <UInput
        v-model="form.q15"
        type="date"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 [color-scheme:dark]"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Who else is in the house? Names and ages.</label>
      <UTextarea
        v-model="form.q16"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        :rows="3"
        placeholder="First name, last name, and age for each member"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Does the child live with both biological parents?</label>
      <URadioGroup
        v-model="form.q17"
        class="mt-2"
        :options="yesNoOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q17Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Additional details (optional)"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Who has custody of the child?</label>
      <UCheckboxGroup
        v-model="form.q18"
        class="mt-2"
        :options="custodyOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q18Other"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Other (please specify)"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">Are you the primary contact?</label>
      <URadioGroup
        v-model="form.q19"
        class="mt-2"
        :options="yesNoOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q19Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Additional details (optional)"
      />
    </div>
  </div>
</template>
