<script setup lang="ts">
  /**
   * Hope. Cope. Heal. — Multi-step form (PDF-exact options).
   * Step 1: Profile, 2: Child, 3: Guardian, 4: Treatment, 5: Therapy.
   * Q2 labeled "First Name" maps to first_name data key in store.
   */
  import { useFormStore } from '~/stores/formStore'

  const props = defineProps<{
    step: number
  }>()

  const { form, first_name } = useFormStore()

  const phoneNumber = computed({
    get: () => form.value.q5,
    set: (value: string) => {
      form.value.q5 = value.replace(/\D+/g, '')
    },
  })

  const legalMotherZipCode = computed({
    get: () => form.value.q25,
    set: (value: string) => {
      form.value.q25 = value.replace(/\D+/g, '')
    },
  })

  const legalFatherZipCode = computed({
    get: () => form.value.q34,
    set: (value: string) => {
      form.value.q34 = value.replace(/\D+/g, '')
    },
  })

  function blockNonNumericInput(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return

    const allowedKeys = new Set([
      'Backspace',
      'Delete',
      'Tab',
      'Enter',
      'Escape',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ])

    if (allowedKeys.has(event.key)) return

    if (!/^\d$/.test(event.key)) {
      event.preventDefault()
    }
  }

  watch(
    () => form.value.q17,
    (value) => {
      if (value !== 'other') {
        form.value.q17Text = ''
      }
    }
  )

  watch(
    () => form.value.q18,
    (values) => {
      if (!values.includes('other')) {
        form.value.q18Other = ''
      }
    },
    { deep: true }
  )

  watch(
    () => form.value.q37,
    (value) => {
      if (value !== 'Other') {
        form.value.q37Other = ''
      }
    }
  )

  watch(
    () => form.value.q46,
    (value) => {
      if (value !== 'other') {
        form.value.q46Other = ''
      }
    }
  )

  // PDF-exact multiple-choice options
  const GENDER_OPTIONS = [
    { label: 'Male', value: 'Male' },
    { label: 'Female', value: 'Female' },
    { label: 'Other', value: 'Other' },
    { label: 'Prefer not to say', value: 'Prefer not to say' },
  ]

  const YES_NO_OPTIONS = [
    { label: 'Yes', value: 'yes' },
    { label: 'No', value: 'no' },
  ]

  // Q17: biological parent residency — Yes, No, Other
  const YES_NO_OTHER_OPTIONS = [
    { label: 'Yes', value: 'yes' },
    { label: 'No', value: 'no' },
    { label: 'Other', value: 'other' },
  ]

  // Q18: Custody — multi-select
  const CUSTODY_OPTIONS = [
    { label: 'Mother', value: 'mother' },
    { label: 'Father', value: 'father' },
    { label: 'Joint', value: 'joint' },
    { label: 'Other', value: 'other' },
  ]

  // Q37: Primary caregiver
  const CAREGIVER_OPTIONS = [
    { label: 'Mom', value: 'Mom' },
    { label: 'Dad', value: 'Dad' },
    { label: 'Other', value: 'Other' },
  ]

  // Q38–39: Sibling trauma / separation
  const SIBLING_OPTIONS = [
    { label: 'Yes', value: 'yes' },
    { label: 'No', value: 'no' },
    { label: 'Not Applicable', value: 'not_applicable' },
  ]

  // Q48: Support Group — PDF grid/list options
  const SUPPORT_GROUP_OPTIONS = [
    { label: 'Parent', value: 'parent' },
    {
      label: 'Adolescent - Child Diagnosed with Cancer',
      value: 'adolescent_child_diagnosed_with_cancer',
    },
    { label: 'Adolescent - Sibling', value: 'adolescent_sibling' },
    { label: 'Grandparent', value: 'grandparent' },
    { label: 'Other', value: 'other' },
  ]

  // Q50: Therapy needs — exact PDF copy
  const REFERRAL_OPTIONS = [
    { label: 'I Have a therapist already', value: 'have_therapist' },
    { label: 'I DO NOT have a therapist and would like a referral', value: 'need_referral' },
  ]

  const INSURANCE_OPTIONS = [
    {
      label: 'Yes, I have insurance with mental health benefits.',
      value: 'yes_with_mental_health_benefits',
    },
    { label: 'No', value: 'no' },
  ]

  const inputClass = 'mt-2 w-full'
  const groupClass =
    'mt-2 !group:border-gray-300 !group:bg-white dark:!group:border-gray-600 dark:!group:bg-gray-800'
</script>

<template>
  <div
    class="space-y-5 [&_h3]:border-gray-300 [&_h3]:text-gray-900 dark:[&_h3]:border-gray-600 dark:[&_h3]:text-gray-100 [&_label]:block [&_label]:text-gray-700 dark:[&_label]:text-gray-200"
  >
    <!-- Step 1: Profile (Q1–8; Q4 removed in app) -->
    <template v-if="step === 1">
      <div>
        <label class="text-sm font-semibold text-gray-200">1. Email</label>
        <UInput v-model="form.q1" type="email" :class="inputClass" placeholder="you@example.com" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">2. First Name</label>
        <UInput v-model="first_name" :class="inputClass" placeholder="First name" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">3. Last Name</label>
        <UInput v-model="form.q3" :class="inputClass" placeholder="Last name" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">4. Phone number</label>
        <UInput
          v-model="phoneNumber"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          :class="inputClass"
          placeholder="Phone number"
          @keydown="blockNonNumericInput"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">5. Gender</label>
        <URadioGroup v-model="form.q6" :class="groupClass" :items="GENDER_OPTIONS" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">6. Date of Birth</label>
        <UInput
          v-model="form.q7"
          type="date"
          :class="inputClass + ' [color-scheme:light] dark:[color-scheme:dark]'"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200"
          >7. Address (Street, Apt, City, State, Zip)</label
        >
        <UTextarea
          v-model="form.q8"
          :class="inputClass"
          :rows="3"
          placeholder="Street address, Apt/Unit, City, State, Zip Code"
        />
      </div>
    </template>

    <!-- Step 2: Child (Q9–19) -->
    <template v-else-if="step === 2">
      <div>
        <label class="text-sm font-semibold text-gray-200">8. Child's First Name</label>
        <UInput v-model="form.q9" :class="inputClass" placeholder="Child's first name" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">9. Child's Last Name</label>
        <UInput v-model="form.q10" :class="inputClass" placeholder="Child's last name" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">10. Child's Date of Birth</label>
        <UInput
          v-model="form.q11"
          type="date"
          :class="inputClass + ' [color-scheme:light] dark:[color-scheme:dark]'"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">11. Gender (Child)</label>
        <URadioGroup v-model="form.q12" :class="groupClass" :items="GENDER_OPTIONS" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">12. Child's address</label>
        <UTextarea
          v-model="form.q13"
          :class="inputClass"
          :rows="3"
          placeholder="Street address, City, State, Zip"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">13. Medical Diagnosis</label>
        <UInput
          v-model="form.q14"
          :class="inputClass"
          placeholder="e.g. type of cancer or condition"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">14. Date of Medical Diagnosis</label>
        <UInput
          v-model="form.q15"
          type="date"
          :class="inputClass + ' [color-scheme:light] dark:[color-scheme:dark]'"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200"
          >15. Please list all members who live in the home (first name, last name, and age)</label
        >
        <UTextarea
          v-model="form.q16"
          :class="inputClass"
          :rows="3"
          placeholder="First name, last name, and age for each member"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200"
          >16. Does child reside with both biological parents?</label
        >
        <URadioGroup v-model="form.q17" :class="groupClass" :items="YES_NO_OTHER_OPTIONS" />
        <UInput
          v-if="form.q17 === 'other'"
          v-model="form.q17Text"
          :class="inputClass"
          class="mt-2"
          placeholder="(please specify)"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">17. Who has custody of the child?</label>
        <UCheckboxGroup v-model="form.q18" :class="groupClass" :items="CUSTODY_OPTIONS" />
        <UInput
          v-if="form.q18.includes('other')"
          v-model="form.q18Other"
          :class="inputClass"
          class="mt-2"
          placeholder="(please specify)"
        />
      </div>
    </template>

    <!-- Step 3: Guardian (Q19–36) -->
    <template v-else-if="step === 3">
      <div>
        <label class="text-sm font-semibold text-gray-200">18. Are you the primary contact?</label>
        <URadioGroup v-model="form.q19" :class="groupClass" :items="YES_NO_OPTIONS" />
      </div>
      <h3 class="mb-2 border-b border-gray-600 pb-2 text-base font-semibold text-gray-100">
        Legal Mother
      </h3>
      <div>
        <label class="text-sm font-semibold text-gray-200">19. Legal Mother's First Name</label
        ><UInput v-model="form.q20" :class="inputClass" placeholder="First name" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">20. Legal Mother's Last Name</label
        ><UInput v-model="form.q21" :class="inputClass" placeholder="Last name" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">21. Legal Mother's Street Address</label
        ><UInput v-model="form.q22" :class="inputClass" placeholder="Street address" />
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="text-sm font-semibold text-gray-200">22. City</label
          ><UInput v-model="form.q23" :class="inputClass" placeholder="City" />
        </div>
        <div>
          <label class="text-sm font-semibold text-gray-200">23. State</label
          ><UInput v-model="form.q24" :class="inputClass" placeholder="State" />
        </div>
        <div>
          <label class="text-sm font-semibold text-gray-200">24. Zip Code</label
          ><UInput
            v-model="legalMotherZipCode"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            :class="inputClass"
            placeholder="Zip code"
            @keydown="blockNonNumericInput"
          />
        </div>
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">25. Legal Mother's Email</label
        ><UInput
          v-model="form.q26"
          type="email"
          :class="inputClass"
          placeholder="email@example.com"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">26. Occupation</label
        ><UInput v-model="form.q27" :class="inputClass" placeholder="Occupation" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200"
          >27. Is Legal Mother primary contact?</label
        >
        <URadioGroup v-model="form.q28" :class="groupClass" :items="YES_NO_OPTIONS" />
      </div>
      <h3 class="mt-6 mb-2 border-b border-gray-600 pb-2 text-base font-semibold text-gray-100">
        Legal Father
      </h3>
      <div>
        <label class="text-sm font-semibold text-gray-200">28. Legal Father's First Name</label
        ><UInput v-model="form.q29" :class="inputClass" placeholder="First name" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">29. Legal Father's Last Name</label
        ><UInput v-model="form.q30" :class="inputClass" placeholder="Last name" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">30. Legal Father's Street Address</label
        ><UInput v-model="form.q31" :class="inputClass" placeholder="Street address" />
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="text-sm font-semibold text-gray-200">31. City</label
          ><UInput v-model="form.q32" :class="inputClass" placeholder="City" />
        </div>
        <div>
          <label class="text-sm font-semibold text-gray-200">32. State</label
          ><UInput v-model="form.q33" :class="inputClass" placeholder="State" />
        </div>
        <div>
          <label class="text-sm font-semibold text-gray-200">33. Zip Code</label
          ><UInput
            v-model="legalFatherZipCode"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            :class="inputClass"
            placeholder="Zip code"
            @keydown="blockNonNumericInput"
          />
        </div>
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">34. Legal Father's Email</label
        ><UInput
          v-model="form.q35"
          type="email"
          :class="inputClass"
          placeholder="email@example.com"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">35. Occupation</label
        ><UInput v-model="form.q36" :class="inputClass" placeholder="Occupation" />
      </div>
    </template>

    <!-- Step 4: Treatment (Q36–45) -->
    <template v-else-if="step === 4">
      <div>
        <label class="text-sm font-semibold text-gray-200">36. Who is the primary caregiver?</label>
        <URadioGroup v-model="form.q37" :class="groupClass" :items="CAREGIVER_OPTIONS" />
        <UInput
          v-if="form.q37 === 'Other'"
          v-model="form.q37Other"
          :class="inputClass"
          class="mt-2"
          placeholder="(please specify)"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200"
          >37. If child has/had siblings, did any witness a scary or traumatic event (e.g. seizures,
          unresponsiveness, death or other medical emergencies)?</label
        >
        <URadioGroup v-model="form.q38" :class="groupClass" :items="SIBLING_OPTIONS" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200"
          >38. Were siblings separated for a prolonged period from a parent and their sibling with
          cancer?</label
        >
        <URadioGroup v-model="form.q39" :class="groupClass" :items="SIBLING_OPTIONS" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200"
          >39. Who was responsible for medical decisions?</label
        >
        <UInput v-model="form.q40" :class="inputClass" placeholder="Name or relationship" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200"
          >40. Who was primarily at the hospital during treatment?</label
        >
        <UInput v-model="form.q41" :class="inputClass" placeholder="Name or relationship" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200"
          >41. How long was the child in treatment?</label
        >
        <UInput v-model="form.q42" :class="inputClass" placeholder="e.g. 6 months, 1 year" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">42. Were there any ICU visits?</label>
        <URadioGroup v-model="form.q43" :class="groupClass" :items="YES_NO_OPTIONS" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200"
          >43. Were there any extended hospital admissions? If so, how long?</label
        >
        <UInput v-model="form.q44" :class="inputClass" placeholder="e.g. 2 weeks, 1 month" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200"
          >44. Did the child have a relapse or secondary cancer?</label
        >
        <URadioGroup v-model="form.q45" :class="groupClass" :items="YES_NO_OPTIONS" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200"
          >45. Did the child with cancer require hospice care and/or pass away?</label
        >
        <URadioGroup v-model="form.q46" :class="groupClass" :items="YES_NO_OTHER_OPTIONS" />
        <UInput
          v-if="form.q46 === 'other'"
          v-model="form.q46Other"
          :class="inputClass"
          class="mt-2"
          placeholder="(please specify)"
        />
      </div>
    </template>

    <!-- Step 5: Therapy (Q46–50) -->
    <template v-else-if="step === 5">
      <div>
        <label class="text-sm font-semibold text-gray-200"
          >46. Are you applying for the Individual Therapy Scholarship?</label
        >
        <URadioGroup v-model="form.q47" :class="groupClass" :items="YES_NO_OPTIONS" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200"
          >47. Would you like to join a Support Group waitlist? If so, please select all that
          apply:</label
        >
        <UCheckboxGroup v-model="form.q48" :class="groupClass" :items="SUPPORT_GROUP_OPTIONS" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200"
          >48. If seeking scholarship for individual therapy, who are you seeking therapy
          scholarship for?</label
        >
        <UInput
          v-model="form.q49"
          :class="inputClass"
          placeholder="Name of person seeking therapy"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200"
          >49. If seeking scholarship for individual therapy, do you have a therapist or need a
          referral?</label
        >
        <URadioGroup v-model="form.q50" :class="groupClass" :items="REFERRAL_OPTIONS" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200"
          >50. Do you currently have medical insurance that provides mental health coverage?</label
        >
        <URadioGroup v-model="form.q51" :class="groupClass" :items="INSURANCE_OPTIONS" />
      </div>
    </template>
  </div>
</template>
