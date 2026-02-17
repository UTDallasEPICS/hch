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
      <label class="text-sm font-semibold text-gray-200">9. Child's First Name</label>
      <UInput
        v-model="form.q9"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="The tiny human's first name. Not 'Thing 1.'"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">10. Child's Last Name</label>
      <UInput
        v-model="form.q10"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Still not 'Thing 1.' We believe in you."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">11. Child's Date of Birth</label>
      <UInput
        v-model="form.q11"
        type="date"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 [color-scheme:dark]"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">12. Gender (Child)</label>
      <URadioGroup
        v-model="form.q12"
        class="mt-2"
        :options="genderOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q12Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Only if it helps. We're not the pronoun police."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">13. Child's address</label>
      <UTextarea
        v-model="form.q13"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        :rows="3"
        placeholder="Same as yours? Different? We've stopped assuming."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">14. Medical Diagnosis</label>
      <UInput
        v-model="form.q14"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="In plain English if you can. We're not all doctors. (We have one. She's great.)"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">15. Date of Medical Diagnosis</label>
      <UInput
        v-model="form.q15"
        type="date"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 [color-scheme:dark]"
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        16. Household members (first name, last name, and age)
      </label>
      <UTextarea
        v-model="form.q16"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        :rows="3"
        placeholder="Names and ages. The dog doesn't count. Unless the dog fills out forms."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">
        17. Does child reside with both biological parents?
      </label>
      <URadioGroup
        v-model="form.q17"
        class="mt-2"
        :options="yesNoOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q17Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="If it's complicated, we get it. We've seen the movies."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">18. Who has custody of the child?</label>
      <UCheckboxGroup
        v-model="form.q18"
        class="mt-2"
        :options="custodyOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q18Other"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="Custody's complicated. We're not here to judge. Probably."
      />
    </div>
    <div>
      <label class="text-sm font-semibold text-gray-200">19. Are you the primary contact?</label>
      <URadioGroup
        v-model="form.q19"
        class="mt-2"
        :options="yesNoOptions"
        ui="group:border-gray-600 group:bg-gray-800"
      />
      <UInput
        v-model="form.q19Text"
        class="mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500"
        placeholder="The one who answers when the school calls. You know the one."
      />
    </div>
  </div>
</template>
