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
      <label class="text-sm font-semibold text-gray-200">20. Legal Mother's First Name</label>
      <UInput
        v-model="form.q20"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Not 'Mom.' We need the one on the paperwork."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">21. Legal Mother's Last Name</label>
      <UInput
        v-model="form.q21"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="The surname situation. We're not here to judge."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">22. Legal Mother's Street Address</label>
      <UInput
        v-model="form.q22"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Where she lives. Or gets mail. We're flexible."
      />
    </div>
    <div class="grid gap-4 sm:grid-cols-3">
      <div>
        <label class="text-sm font-semibold text-gray-200">23. City</label>
        <UInput
          v-model="form.q23"
          class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
          placeholder="The one with good coffee."
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">24. State</label>
        <UInput
          v-model="form.q24"
          class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
          placeholder="Two letters. You've got this."
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">25. Zip Code</label>
        <UInput
          v-model="form.q25"
          class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
          placeholder="The number that makes mail happen."
        />
      </div>
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">26. Legal Mother's Email</label>
      <UInput
        v-model="form.q26"
        type="email"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="We promise not to spam. Unless it's memes."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">27. Occupation</label>
      <UInput
        v-model="form.q27"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="What she does when she's not being a superhero parent."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">28. Is Legal Mother primary contact?</label>
      <URadioGroup
        v-model="form.q28"
        class="mt-2"
        :options="yesNoOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q28Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="The one who gets the 2am calls. You know."
      />
    </div>

    <h3 class="text-base font-semibold text-gray-100 border-b border-gray-600 pb-2 mt-6 mb-2">
      Legal Father
    </h3>
    <div>
      <label class="text-sm font-semibold text-gray-200">29. Legal Father's First Name</label>
      <UInput
        v-model="form.q29"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Again, not 'Dad.' The legal one."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">30. Legal Father's Last Name</label>
      <UInput
        v-model="form.q30"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Surname: the sequel."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">31. Legal Father's Street Address</label>
      <UInput
        v-model="form.q31"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Where he's at. Or gets mail. Same deal."
      />
    </div>
    <div class="grid gap-4 sm:grid-cols-3">
      <div>
        <label class="text-sm font-semibold text-gray-200">32. City</label>
        <UInput
          v-model="form.q32"
          class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
          placeholder="City. We're copy-pasting vibes."
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">33. State</label>
        <UInput
          v-model="form.q33"
          class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
          placeholder="Two letters. Round two."
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">34. Zip Code</label>
        <UInput
          v-model="form.q34"
          class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
          placeholder="Zip. The sequel. (We're tired too.)"
        />
      </div>
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">35. Legal Father's Email</label>
      <UInput
        v-model="form.q35"
        type="email"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Still no spam. Our word is good."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">36. Occupation</label>
      <UInput
        v-model="form.q36"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="What he does. Besides being a legend."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">37. Who is the primary caregiver?</label>
      <URadioGroup
        v-model="form.q37"
        class="mt-2"
        :options="caregiverOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q37Other"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="If it's a rotating cast, we've got time."
      />
    </div>
  </div>
</template>
