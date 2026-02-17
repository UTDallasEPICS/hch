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
      <label class="text-sm font-semibold text-gray-200">1. Email</label>
      <UInput
        v-model="form.q1"
        type="email"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Your actual email. Not your ex's. We've seen things."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">2. First Name</label>
      <UInput
        v-model="form.q2"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="The one on your license. Or the one you actually use. We're chill."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">3. Last Name</label>
      <UInput
        v-model="form.q3"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Same energy as above."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">4. Phone number</label>
      <UInput
        v-model="form.q5"
        type="tel"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="We'll only call for good reasons. And maybe dad jokes."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">6. Gender</label>
      <URadioGroup
        v-model="form.q6"
        class="mt-2"
        :options="genderOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q6Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Whatever helps us get the pronouns right. No judgment."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">7. Date of Birth</label>
      <UInput
        v-model="form.q7"
        type="date"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 [color-scheme:dark]"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        8. Address (Street, Apt, City, State, Zip)
      </label>
      <UTextarea
        v-model="form.q8"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        :rows="3"
        placeholder="Where we can send mail that isn't from your past self. Street, Apt, City, State, Zip."
      />
    </div>
  </div>
</template>
