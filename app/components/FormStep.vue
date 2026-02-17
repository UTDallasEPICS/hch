<script setup lang="ts">
/**
 * Hope. Cope. Heal. — Multi-step form (PDF-exact options).
 * Step 1: Profile, 2: Child, 3: Guardian, 4: Treatment, 5: Therapy.
 * Q2 labeled "His Name" maps to first_name data key in store.
 */
import { useFormStore } from '~/stores/formStore'

const props = defineProps<{
  step: number
}>()

const { form, first_name } = useFormStore()

// PDF-exact multiple-choice options
const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
  { label: 'Other', value: 'other' },
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
  { label: 'Mom', value: 'mom' },
  { label: 'Dad', value: 'dad' },
  { label: 'Other', value: 'other' },
]

// Q38–39: Sibling trauma / separation
const SIBLING_OPTIONS = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
  { label: 'Not Applicable', value: 'not_applicable' },
]

// Q46: Hospice / passing away — Yes, No, Other
const HOSPICE_OPTIONS = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
  { label: 'Other', value: 'other' },
]

// Q48: Support Group — PDF grid/list options
const SUPPORT_GROUP_OPTIONS = [
  { label: 'Parent', value: 'parent' },
  { label: 'Adolescent (Diagnosed)', value: 'adolescent_diagnosed' },
  { label: 'Adolescent (Sibling)', value: 'adolescent_sibling' },
  { label: 'Grandparent', value: 'grandparent' },
]

// Q50: Therapy needs — exact PDF copy
const REFERRAL_OPTIONS = [
  { label: 'I Have a therapist already', value: 'have_therapist' },
  { label: 'I DO NOT have a therapist and would like a referral', value: 'need_referral' },
]

// Q51: Insurance — exact PDF copy
const INSURANCE_OPTIONS = [
  { label: 'Yes, I have insurance with mental health benefits', value: 'yes' },
  { label: 'No', value: 'no' },
]

const inputClass = 'mt-2 border-gray-600 bg-gray-800 text-gray-100 placeholder:text-gray-500'
const groupClass = 'mt-2 group:border-gray-600 group:bg-gray-800'
</script>

<template>
  <div class="space-y-5 [&_label]:block">
    <!-- Step 1: Profile (Q1–8; Q4 removed in app) -->
    <template v-if="step === 1">
      <div>
        <label class="text-sm font-semibold text-gray-200">1. Email</label>
        <UInput v-model="form.q1" type="email" :class="inputClass" placeholder="you@example.com" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">2. His Name</label>
        <UInput v-model="first_name" :class="inputClass" placeholder="First name" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">3. Last Name</label>
        <UInput v-model="form.q3" :class="inputClass" placeholder="Last name" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">4. Phone number</label>
        <UInput v-model="form.q5" type="tel" :class="inputClass" placeholder="(555) 000-0000" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">5. Gender</label>
        <URadioGroup v-model="form.q6" :class="groupClass" :options="GENDER_OPTIONS" ui="group:border-gray-600 group:bg-gray-800" />
        <UInput v-model="form.q6Text" :class="inputClass" class="mt-2" placeholder="Additional details (optional)" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">6. Date of Birth</label>
        <UInput v-model="form.q7" type="date" :class="inputClass + ' [color-scheme:dark]'" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">7. Address (Street, Apt, City, State, Zip)</label>
        <UTextarea v-model="form.q8" :class="inputClass" :rows="3" placeholder="Street address, Apt/Unit, City, State, Zip Code" />
      </div>
    </template>

    <!-- Step 2: Child (Q9–19) -->
    <template v-else-if="step === 2">
      <div>
        <label class="text-sm font-semibold text-gray-200">9. Child's First Name</label>
        <UInput v-model="form.q9" :class="inputClass" placeholder="Child's first name" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">10. Child's Last Name</label>
        <UInput v-model="form.q10" :class="inputClass" placeholder="Child's last name" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">11. Child's Date of Birth</label>
        <UInput v-model="form.q11" type="date" :class="inputClass + ' [color-scheme:dark]'" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">12. Gender (Child)</label>
        <URadioGroup v-model="form.q12" :class="groupClass" :options="GENDER_OPTIONS" ui="group:border-gray-600 group:bg-gray-800" />
        <UInput v-model="form.q12Text" :class="inputClass" class="mt-2" placeholder="Additional details (optional)" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">13. Child's address</label>
        <UTextarea v-model="form.q13" :class="inputClass" :rows="3" placeholder="Street address, City, State, Zip" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">14. Medical Diagnosis</label>
        <UInput v-model="form.q14" :class="inputClass" placeholder="e.g. type of cancer or condition" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">15. Date of Medical Diagnosis</label>
        <UInput v-model="form.q15" type="date" :class="inputClass + ' [color-scheme:dark]'" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">16. Please list all members who live in the home (first name, last name, and age)</label>
        <UTextarea v-model="form.q16" :class="inputClass" :rows="3" placeholder="First name, last name, and age for each member" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">17. Does child reside with both biological parents?</label>
        <URadioGroup v-model="form.q17" :class="groupClass" :options="YES_NO_OTHER_OPTIONS" ui="group:border-gray-600 group:bg-gray-800" />
        <UInput v-model="form.q17Text" :class="inputClass" class="mt-2" placeholder="Additional details (optional)" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">18. Who has custody of the child?</label>
        <UCheckboxGroup v-model="form.q18" :class="groupClass" :options="CUSTODY_OPTIONS" ui="group:border-gray-600 group:bg-gray-800" />
        <UInput v-model="form.q18Other" :class="inputClass" class="mt-2" placeholder="Other (please specify)" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">19. Are you the primary contact?</label>
        <URadioGroup v-model="form.q19" :class="groupClass" :options="YES_NO_OPTIONS" ui="group:border-gray-600 group:bg-gray-800" />
        <UInput v-model="form.q19Text" :class="inputClass" class="mt-2" placeholder="Additional details (optional)" />
      </div>
    </template>

    <!-- Step 3: Guardian (Q20–37) -->
    <template v-else-if="step === 3">
      <h3 class="text-base font-semibold text-gray-100 border-b border-gray-600 pb-2 mb-2">Legal Mother</h3>
      <div><label class="text-sm font-semibold text-gray-200">20. Legal Mother's First Name</label><UInput v-model="form.q20" :class="inputClass" placeholder="First name" /></div>
      <div><label class="text-sm font-semibold text-gray-200">21. Legal Mother's Last Name</label><UInput v-model="form.q21" :class="inputClass" placeholder="Last name" /></div>
      <div><label class="text-sm font-semibold text-gray-200">22. Legal Mother's Street Address</label><UInput v-model="form.q22" :class="inputClass" placeholder="Street address" /></div>
      <div class="grid gap-4 sm:grid-cols-3">
        <div><label class="text-sm font-semibold text-gray-200">23. City</label><UInput v-model="form.q23" :class="inputClass" placeholder="City" /></div>
        <div><label class="text-sm font-semibold text-gray-200">24. State</label><UInput v-model="form.q24" :class="inputClass" placeholder="State" /></div>
        <div><label class="text-sm font-semibold text-gray-200">25. Zip Code</label><UInput v-model="form.q25" :class="inputClass" placeholder="Zip code" /></div>
      </div>
      <div><label class="text-sm font-semibold text-gray-200">26. Legal Mother's Email</label><UInput v-model="form.q26" type="email" :class="inputClass" placeholder="email@example.com" /></div>
      <div><label class="text-sm font-semibold text-gray-200">27. Occupation</label><UInput v-model="form.q27" :class="inputClass" placeholder="Occupation" /></div>
      <div>
        <label class="text-sm font-semibold text-gray-200">28. Is Legal Mother primary contact?</label>
        <URadioGroup v-model="form.q28" :class="groupClass" :options="YES_NO_OPTIONS" ui="group:border-gray-600 group:bg-gray-800" />
        <UInput v-model="form.q28Text" :class="inputClass" class="mt-2" placeholder="Additional details (optional)" />
      </div>
      <h3 class="text-base font-semibold text-gray-100 border-b border-gray-600 pb-2 mt-6 mb-2">Legal Father</h3>
      <div><label class="text-sm font-semibold text-gray-200">29. Legal Father's First Name</label><UInput v-model="form.q29" :class="inputClass" placeholder="First name" /></div>
      <div><label class="text-sm font-semibold text-gray-200">30. Legal Father's Last Name</label><UInput v-model="form.q30" :class="inputClass" placeholder="Last name" /></div>
      <div><label class="text-sm font-semibold text-gray-200">31. Legal Father's Street Address</label><UInput v-model="form.q31" :class="inputClass" placeholder="Street address" /></div>
      <div class="grid gap-4 sm:grid-cols-3">
        <div><label class="text-sm font-semibold text-gray-200">32. City</label><UInput v-model="form.q32" :class="inputClass" placeholder="City" /></div>
        <div><label class="text-sm font-semibold text-gray-200">33. State</label><UInput v-model="form.q33" :class="inputClass" placeholder="State" /></div>
        <div><label class="text-sm font-semibold text-gray-200">34. Zip Code</label><UInput v-model="form.q34" :class="inputClass" placeholder="Zip code" /></div>
      </div>
      <div><label class="text-sm font-semibold text-gray-200">35. Legal Father's Email</label><UInput v-model="form.q35" type="email" :class="inputClass" placeholder="email@example.com" /></div>
      <div><label class="text-sm font-semibold text-gray-200">36. Occupation</label><UInput v-model="form.q36" :class="inputClass" placeholder="Occupation" /></div>
      <div>
        <label class="text-sm font-semibold text-gray-200">37. Who is the primary caregiver?</label>
        <URadioGroup v-model="form.q37" :class="groupClass" :options="CAREGIVER_OPTIONS" ui="group:border-gray-600 group:bg-gray-800" />
        <UInput v-model="form.q37Other" :class="inputClass" class="mt-2" placeholder="Other (please specify)" />
      </div>
    </template>

    <!-- Step 4: Treatment (Q38–46) -->
    <template v-else-if="step === 4">
      <div>
        <label class="text-sm font-semibold text-gray-200">38. If child has/had siblings, did any witness a scary or traumatic event (e.g. seizures, unresponsiveness, death or other medical emergencies)?</label>
        <URadioGroup v-model="form.q38" :class="groupClass" :options="SIBLING_OPTIONS" ui="group:border-gray-600 group:bg-gray-800" />
        <UInput v-model="form.q38Text" :class="inputClass" class="mt-2" placeholder="Additional details (optional)" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">39. Were siblings separated for a prolonged period from a parent and their sibling with cancer?</label>
        <URadioGroup v-model="form.q39" :class="groupClass" :options="SIBLING_OPTIONS" ui="group:border-gray-600 group:bg-gray-800" />
        <UInput v-model="form.q39Text" :class="inputClass" class="mt-2" placeholder="Additional details (optional)" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">40. Who was responsible for medical decisions?</label>
        <UInput v-model="form.q40" :class="inputClass" placeholder="Name or relationship" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">41. Who was primarily at the hospital during treatment?</label>
        <UInput v-model="form.q41" :class="inputClass" placeholder="Name or relationship" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">42. How long was the child in treatment?</label>
        <UInput v-model="form.q42" :class="inputClass" placeholder="e.g. 6 months, 1 year" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">43. Were there any ICU visits?</label>
        <URadioGroup v-model="form.q43" :class="groupClass" :options="YES_NO_OPTIONS" ui="group:border-gray-600 group:bg-gray-800" />
        <UInput v-model="form.q43Text" :class="inputClass" class="mt-2" placeholder="Additional details (optional)" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">44. Were there any extended hospital admissions? If so, how long?</label>
        <UInput v-model="form.q44" :class="inputClass" placeholder="e.g. 2 weeks, 1 month" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">45. Did the child have a relapse or secondary cancer?</label>
        <URadioGroup v-model="form.q45" :class="groupClass" :options="YES_NO_OPTIONS" ui="group:border-gray-600 group:bg-gray-800" />
        <UInput v-model="form.q45Text" :class="inputClass" class="mt-2" placeholder="Additional details (optional)" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">46. Did the child with cancer require hospice care and/or pass away?</label>
        <URadioGroup v-model="form.q46" :class="groupClass" :options="HOSPICE_OPTIONS" ui="group:border-gray-600 group:bg-gray-800" />
        <UInput v-model="form.q46Other" :class="inputClass" class="mt-2" placeholder="Other (please specify)" />
      </div>
    </template>

    <!-- Step 5: Therapy (Q47–51) -->
    <template v-else-if="step === 5">
      <div>
        <label class="text-sm font-semibold text-gray-200">47. Are you applying for the Individual Therapy Scholarship?</label>
        <URadioGroup v-model="form.q47" :class="groupClass" :options="YES_NO_OPTIONS" ui="group:border-gray-600 group:bg-gray-800" />
        <UInput v-model="form.q47Text" :class="inputClass" class="mt-2" placeholder="Additional details (optional)" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">48. Would you like to join a Support Group waitlist? If so, please select one.</label>
        <div class="mt-2 grid gap-3 sm:grid-cols-2">
          <label
            v-for="opt in SUPPORT_GROUP_OPTIONS"
            :key="opt.value"
            class="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-600 bg-gray-800 p-3 text-gray-100 transition-colors hover:bg-gray-700/80"
          >
            <input
              v-model="form.q48"
              type="radio"
              :value="opt.value"
              class="h-4 w-4 border-gray-500 text-primary-500 focus:ring-primary-500"
            />
            <span class="text-sm">{{ opt.label }}</span>
          </label>
        </div>
        <UInput v-model="form.q48Text" :class="inputClass" class="mt-2" placeholder="Additional details (optional)" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">49. If seeking scholarship for individual therapy, who are you seeking therapy scholarship for?</label>
        <UInput v-model="form.q49" :class="inputClass" placeholder="Name of person seeking therapy" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">50. If seeking scholarship for individual therapy, do you have a therapist or need a referral?</label>
        <URadioGroup v-model="form.q50" :class="groupClass" :options="REFERRAL_OPTIONS" ui="group:border-gray-600 group:bg-gray-800" />
        <UInput v-model="form.q50Text" :class="inputClass" class="mt-2" placeholder="Additional details (optional)" />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-200">51. Do you currently have medical insurance that provides mental health coverage?</label>
        <URadioGroup v-model="form.q51" :class="groupClass" :options="INSURANCE_OPTIONS" ui="group:border-gray-600 group:bg-gray-800" />
        <UInput v-model="form.q51Text" :class="inputClass" class="mt-2" placeholder="Additional details (optional)" />
      </div>
    </template>
  </div>
</template>
