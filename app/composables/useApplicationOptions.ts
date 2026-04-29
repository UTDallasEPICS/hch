// Shared options (gender, yes/no, custody, etc.)
export function useApplicationOptions() {
  const genderOptions = [
    { label: 'Male', value: 'Male' },
    { label: 'Female', value: 'Female' },
    { label: 'Non-binary', value: 'Non-binary' },
    { label: 'Prefer not to say', value: 'Prefer not to say' },
    { label: 'Other', value: 'Other' },
  ]
  const yesNoOptions = [
    { label: 'Yes', value: 'yes' },
    { label: 'No', value: 'no' },
  ]
  const custodyOptions = [
    { label: 'Mother', value: 'mother' },
    { label: 'Father', value: 'father' },
    { label: 'Joint', value: 'joint' },
    { label: 'Other', value: 'other' },
  ]
  const caregiverOptions = [
    { label: 'Mom', value: 'Mom' },
    { label: 'Dad', value: 'Dad' },
    { label: 'Both', value: 'Both' },
    { label: 'Other', value: 'Other' },
  ]
  const siblingOptions = [
    { label: 'Yes', value: 'yes' },
    { label: 'No', value: 'no' },
    { label: 'N/A', value: 'na' },
  ]
  const supportGroupOptions = [
    { label: 'Adolescent child diagnosed with cancer', value: 'adolescent_child_diagnosed_with_cancer' },
    { label: 'Adolescent sibling', value: 'adolescent_sibling' },
    { label: 'Parent', value: 'parent' },
    { label: 'No', value: 'no' },
  ]
  const referralOptions = [
    { label: 'I have a therapist', value: 'have_therapist' },
    { label: 'I need a referral', value: 'need_referral' },
  ]
  const insuranceOptions = [
    { label: 'Yes, with mental health benefits', value: 'yes_with_mental_health_benefits' },
    { label: 'Yes, without mental health benefits', value: 'yes_without_mental_health_benefits' },
    { label: 'No insurance', value: 'no_insurance' },
  ]

  return {
    genderOptions,
    yesNoOptions,
    custodyOptions,
    caregiverOptions,
    siblingOptions,
    supportGroupOptions,
    referralOptions,
    insuranceOptions,
  }
}