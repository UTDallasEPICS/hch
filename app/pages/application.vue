<script setup lang="ts">
  const toast = useToast()
  const isSaving = ref(false)

  const form = reactive({
    q1: '',
    q2: '',
    q3: '',
    q4: '',
    q5: '',
    q6: '',
    q6Text: '',
    q7: '',
    q8: '',
    q9: '',
    q10: '',
    q11: '',
    q12: '',
    q12Text: '',
    q13: '',
    q14: '',
    q15: '',
    q16: '',
    q17: '',
    q17Text: '',
    q18: [] as string[],
    q18Other: '',
    q19: '',
    q19Text: '',
    q20: '',
    q21: '',
    q22: '',
    q23: '',
    q24: '',
    q25: '',
    q26: '',
    q27: '',
    q28: '',
    q28Text: '',
    q29: '',
    q30: '',
    q31: '',
    q32: '',
    q33: '',
    q34: '',
    q35: '',
    q36: '',
    q37: '',
    q37Other: '',
    q38: '',
    q38Text: '',
    q39: '',
    q39Text: '',
    q40: '',
    q41: '',
    q42: '',
    q43: '',
    q43Text: '',
    q44: '',
    q45: '',
    q45Text: '',
    q46: '',
    q46Other: '',
    q47: '',
    q47Text: '',
    q48: '',
    q48Text: '',
    q49: '',
    q50: '',
    q50Text: '',
    q51: '',
    q51Text: '',
  })

  type AppAnswerPayload = Record<string, string | null | undefined>

  const questionDetailFieldMap: Record<number, string> = {
    6: 'q6Text',
    12: 'q12Text',
    17: 'q17Text',
    19: 'q19Text',
    28: 'q28Text',
    37: 'q37Other',
    38: 'q38Text',
    39: 'q39Text',
    43: 'q43Text',
    45: 'q45Text',
    46: 'q46Other',
    47: 'q47Text',
    48: 'q48Text',
    50: 'q50Text',
    51: 'q51Text',
  }

  function applySavedAnswers(answers?: AppAnswerPayload | null) {
    if (!answers) {
      return
    }

    for (let index = 1; index <= 51; index += 1) {
      const key = `q${String(index).padStart(2, '0')}`
      const value = answers[key]

      if (index === 18) {
        if (typeof value === 'string' && value.length > 0) {
          try {
            const parsed = JSON.parse(value)
            form.q18 = Array.isArray(parsed) ? parsed : []
          } catch {
            form.q18 = []
          }
        } else {
          form.q18 = []
        }
        continue
      }

      const detailField = questionDetailFieldMap[index]
      if (detailField) {
        const formKey = `q${index}`

        if (typeof value === 'string' && value.length > 0) {
          try {
            const parsed = JSON.parse(value) as { value?: string; text?: string }
            ;(form as Record<string, unknown>)[formKey] = parsed.value ?? ''
            ;(form as Record<string, unknown>)[detailField] = parsed.text ?? ''
          } catch {
            ;(form as Record<string, unknown>)[formKey] = value
            ;(form as Record<string, unknown>)[detailField] = ''
          }
        } else {
          ;(form as Record<string, unknown>)[formKey] = ''
          ;(form as Record<string, unknown>)[detailField] = ''
        }

        continue
      }

      ;(form as Record<string, unknown>)[`q${index}`] = value ?? ''
    }
  }

  async function saveAndExit() {
    try {
      isSaving.value = true

      const payload: Record<string, string> = {}
      for (let index = 1; index <= 51; index += 1) {
        if (index === 18) {
          payload.q18 = JSON.stringify(form.q18 ?? [])
          continue
        }

        const detailField = questionDetailFieldMap[index]
        if (detailField) {
          const selected = (form as Record<string, unknown>)[`q${index}`]
          const detail = (form as Record<string, unknown>)[detailField]
          const selectedValue = typeof selected === 'string' ? selected : ''
          const detailValue = typeof detail === 'string' ? detail : ''

          if (selectedValue.length === 0 && detailValue.length === 0) {
            payload[`q${index}`] = ''
          } else {
            payload[`q${index}`] = JSON.stringify({
              value: selectedValue,
              text: detailValue,
            })
          }

          continue
        }

        const value = (form as Record<string, unknown>)[`q${index}`]
        payload[`q${index}`] = typeof value === 'string' ? value : ''
      }

      await $fetch('/api/application/save', {
        method: 'POST',
        body: payload,
      })

      await navigateTo('/taskPage')
    } catch (error) {
      toast.add({
        title: 'Save failed',
        description: 'Your answers could not be saved. Please try again.',
        color: 'error',
      })
    } finally {
      isSaving.value = false
    }
  }

  const genderOptions = [
    { label: 'Female', value: 'female' },
    { label: 'Male', value: 'male' },
    { label: 'Non-binary', value: 'non_binary' },
    { label: 'Prefer not to say', value: 'prefer_not_to_say' },
    { label: 'Other', value: 'other' },
  ]

  const yesNoOptions = [
    { label: 'Yes', value: 'yes' },
    { label: 'No', value: 'no' },
  ]

  const custodyOptions = [
    { label: 'Mother', value: 'mother' },
    { label: 'Father', value: 'father' },
    { label: 'Shared', value: 'shared' },
    { label: 'Guardian', value: 'guardian' },
    { label: 'Other', value: 'other' },
  ]

  const caregiverOptions = [
    { label: 'Mother', value: 'mother' },
    { label: 'Father', value: 'father' },
    { label: 'Guardian', value: 'guardian' },
    { label: 'Other', value: 'other' },
  ]

  const supportGroupOptions = [
    { label: 'Group A', value: 'group_a' },
    { label: 'Group B', value: 'group_b' },
    { label: 'Group C', value: 'group_c' },
    { label: 'Other', value: 'other' },
  ]

  const referralOptions = [
    { label: 'Have a therapist', value: 'have_therapist' },
    { label: 'Need a referral', value: 'need_referral' },
  ]

  onMounted(async () => {
    const response = await $fetch<{ answers?: AppAnswerPayload | null }>('/api/application/start', {
      method: 'POST',
    })

    applySavedAnswers(response?.answers)
  })
</script>

<template>
  <UContainer class="py-10">
    <div class="mb-8">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Application</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Please complete all required questions.
      </p>
    </div>

    <div class="space-y-6">
      <UCard>
        <div class="space-y-5 [&_label]:block">
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >1. Email (Text)</label
            >
            <UInput v-model="form.q1" class="mt-2" type="email" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >2. Your First Name (Text)</label
            >
            <UInput v-model="form.q2" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >3. Your Last Name (Text)</label
            >
            <UInput v-model="form.q3" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >4. Your email address (Text)</label
            >
            <UInput v-model="form.q4" class="mt-2" type="email" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >5. Your phone number (Text)</label
            >
            <UInput v-model="form.q5" class="mt-2" type="tel" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >6. Gender (Multiple choice)</label
            >
            <URadioGroup v-model="form.q6" class="mt-2" :options="genderOptions" />
            <UInput v-model="form.q6Text" class="mt-2" placeholder="Additional details" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >7. Your Date of Birth (Text)</label
            >
            <UInput v-model="form.q7" class="mt-2" placeholder="MM/DD/YYYY" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              8. Address (Street Address, Apt, City, State, Zip Code) (Text)
            </label>
            <UTextarea v-model="form.q8" class="mt-2" :rows="3" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >9. Child’s First Name (Text)</label
            >
            <UInput v-model="form.q9" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >10. Child’s Last Name (Text)</label
            >
            <UInput v-model="form.q10" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >11. Child’s Date of Birth (Text)</label
            >
            <UInput v-model="form.q11" class="mt-2" placeholder="MM/DD/YYYY" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              12. Gender (Child) (Multiple choice)
            </label>
            <URadioGroup v-model="form.q12" class="mt-2" :options="genderOptions" />
            <UInput v-model="form.q12Text" class="mt-2" placeholder="Additional details" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >13. Child’s address (Text)</label
            >
            <UTextarea v-model="form.q13" class="mt-2" :rows="3" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >14. Medical Diagnosis (Text)</label
            >
            <UInput v-model="form.q14" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              15. Date of Medical Diagnosis (Text)
            </label>
            <UInput v-model="form.q15" class="mt-2" placeholder="MM/DD/YYYY" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              16. Please list all the members who live in the home with you (include first name,
              last name, and age)
            </label>
            <UTextarea v-model="form.q16" class="mt-2" :rows="3" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              17. Does child reside with both biological parents? (Multiple choice)
            </label>
            <URadioGroup v-model="form.q17" class="mt-2" :options="yesNoOptions" />
            <UInput v-model="form.q17Text" class="mt-2" placeholder="Additional details" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              18. Who has custody of the child? (Checkboxes — Multi-select + Text “Other”)
            </label>
            <UCheckboxGroup v-model="form.q18" class="mt-2" :options="custodyOptions" />
            <UInput v-model="form.q18Other" class="mt-2" placeholder="Other (please specify)" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              19. Are you the primary contact? (Multiple choice)
            </label>
            <URadioGroup v-model="form.q19" class="mt-2" :options="yesNoOptions" />
            <UInput v-model="form.q19Text" class="mt-2" placeholder="Additional details" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >20. Legal Mother’s First Name (Text)</label
            >
            <UInput v-model="form.q20" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >21. Legal Mother’s Last Name (Text)</label
            >
            <UInput v-model="form.q21" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >22. Legal Mother’s Street Address (Text)</label
            >
            <UInput v-model="form.q22" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >23. City (Text)</label
            >
            <UInput v-model="form.q23" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >24. State (Text)</label
            >
            <UInput v-model="form.q24" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >25. Zip Code (Text)</label
            >
            <UInput v-model="form.q25" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >26. Legal Mother’s Email (Text)</label
            >
            <UInput v-model="form.q26" class="mt-2" type="email" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >27. Occupation (Text)</label
            >
            <UInput v-model="form.q27" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              28. Are you the primary contact? (Multiple choice)
            </label>
            <URadioGroup v-model="form.q28" class="mt-2" :options="yesNoOptions" />
            <UInput v-model="form.q28Text" class="mt-2" placeholder="Additional details" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >29. Legal Father’s First Name (Text)</label
            >
            <UInput v-model="form.q29" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >30. Legal Father’s Last Name (Text)</label
            >
            <UInput v-model="form.q30" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >31. Legal Father’s Street Address (Text)</label
            >
            <UInput v-model="form.q31" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >32. City (Text)</label
            >
            <UInput v-model="form.q32" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >33. State (Text)</label
            >
            <UInput v-model="form.q33" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >34. Zip Code (Text)</label
            >
            <UInput v-model="form.q34" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >35. Legal Father’s Email (Text)</label
            >
            <UInput v-model="form.q35" class="mt-2" type="email" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >36. Occupation (Text)</label
            >
            <UInput v-model="form.q36" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              37. Who is the primary caregiver? (Multiple choice + Text “Other”)
            </label>
            <URadioGroup v-model="form.q37" class="mt-2" :options="caregiverOptions" />
            <UInput v-model="form.q37Other" class="mt-2" placeholder="Other (please specify)" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              38. If child has/had siblings, did any siblings witness a scary or traumatic event
              such as seizures, unresponsiveness, death or other medical emergencies? (Multiple
              choice)
            </label>
            <URadioGroup v-model="form.q38" class="mt-2" :options="yesNoOptions" />
            <UInput v-model="form.q38Text" class="mt-2" placeholder="Additional details" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              39. Were siblings separated for a prolonged period of time from a parent and their
              sibling with cancer? (Multiple choice)
            </label>
            <URadioGroup v-model="form.q39" class="mt-2" :options="yesNoOptions" />
            <UInput v-model="form.q39Text" class="mt-2" placeholder="Additional details" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >40. Who was responsible for medical decisions? (Text)</label
            >
            <UInput v-model="form.q40" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              41. Who was primarily at the hospital during treatment? (Text)
            </label>
            <UInput v-model="form.q41" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >42. How long was your child in treatment? (Text)</label
            >
            <UInput v-model="form.q42" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >43. Were there any ICU visits? (Multiple choice)</label
            >
            <URadioGroup v-model="form.q43" class="mt-2" :options="yesNoOptions" />
            <UInput v-model="form.q43Text" class="mt-2" placeholder="Additional details" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              44. Were there any extended hospital admissions? If so, how long? (Text)
            </label>
            <UInput v-model="form.q44" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white"
              >45. Did your child have a relapse or secondary cancer? (Multiple choice)</label
            >
            <URadioGroup v-model="form.q45" class="mt-2" :options="yesNoOptions" />
            <UInput v-model="form.q45Text" class="mt-2" placeholder="Additional details" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              46. Did your child with cancer require hospice care and/or pass away? (Multiple choice
              + Text “Other”)
            </label>
            <URadioGroup v-model="form.q46" class="mt-2" :options="yesNoOptions" />
            <UInput v-model="form.q46Other" class="mt-2" placeholder="Other (please specify)" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              47. Are you applying for the Individual Therapy Scholarship? (Multiple choice)
            </label>
            <URadioGroup v-model="form.q47" class="mt-2" :options="yesNoOptions" />
            <UInput v-model="form.q47Text" class="mt-2" placeholder="Additional details" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              48. Would you like to join a Support Group waitlist? If so, please select one:
              (Multiple choice grid)
            </label>
            <URadioGroup v-model="form.q48" class="mt-2" :options="supportGroupOptions" />
            <UInput v-model="form.q48Text" class="mt-2" placeholder="Additional details" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              49. If you are seeking scholarship for individual therapy, who are you seeking therapy
              scholarship for? (Text)
            </label>
            <UInput v-model="form.q49" class="mt-2" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              50. If you are seeking scholarship for individual therapy, do you have a therapist or
              need a referral? (Multiple choice)
            </label>
            <URadioGroup v-model="form.q50" class="mt-2" :options="referralOptions" />
            <UInput v-model="form.q50Text" class="mt-2" placeholder="Additional details" />
          </div>
          <div>
            <label class="text-sm font-semibold text-gray-900 dark:text-white">
              51. Do you currently have medical insurance that provides mental health coverage?
              (Multiple choice)
            </label>
            <URadioGroup v-model="form.q51" class="mt-2" :options="yesNoOptions" />
            <UInput v-model="form.q51Text" class="mt-2" placeholder="Additional details" />
          </div>
        </div>
      </UCard>
    </div>

    <div class="mt-10">
      <UButton
        label="Save and Exit"
        color="error"
        variant="soft"
        :loading="isSaving"
        @click="saveAndExit"
      />
    </div>
  </UContainer>
</template>
