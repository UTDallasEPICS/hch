/**
 * Development-only seed data for form autofill.
 * Based on Luke Ross from the Disney Channel show "Jessie"
 * 
 * Character Background:
 * - Adopted from a group home in Detroit by Morgan and Christina Ross
 * - Born December 28, 2001
 * - Lives at a penthouse in NYC with his adoptive family
 * - Has abandonment issues from his early childhood
 * - Athletic, loves sports and video games
 * - Siblings: Emma, Ravi, and Zuri (all adopted)
 */

export const isDev = () => {
  if (typeof window === 'undefined') {
    return process.env.NODE_ENV === 'development'
  }
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

export interface ApplicationSeedData {
  q1: string
  q2: string
  q3: string
  q4: string
  q5: string
  q6: string
  q6Text: string
  q7: string
  q8: string
  q9: string
  q10: string
  q11: string
  q12: string
  q12Text: string
  q13: string
  q14: string
  q15: string
  q16: string
  q17: string
  q17Text: string
  q18: string[]
  q18Other: string
  q19: string
  q19Text: string
  q20: string
  q21: string
  q22: string
  q23: string
  q24: string
  q25: string
  q26: string
  q27: string
  q28: string
  q28Text: string
  q29: string
  q30: string
  q31: string
  q32: string
  q33: string
  q34: string
  q35: string
  q36: string
  q37: string
  q37Other: string
  q38: string
  q38Text: string
  q39: string
  q39Text: string
  q40: string
  q41: string
  q42: string
  q43: string
  q43Text: string
  q44: string
  q45: string
  q45Text: string
  q46: string
  q46Other: string
  q47: string
  q47Text: string
  q48: string[]
  q49: string
  q50: string
  q50Text: string
  q51: string
}

export const applicationSeedData: ApplicationSeedData = {
  // Step 1: User Profile
  q1: 'luke.ross@example.com',
  q2: 'Christina',
  q3: 'Ross',
  q4: '',
  q5: '2125551234',
  q6: 'Female',
  q6Text: '',
  q7: '1975-06-15',
  q8: '725 Fifth Avenue|||New York|||NY|||10022',
  
  // Step 2: Child's Information
  q9: 'Luke',
  q10: 'Ross',
  q11: '2001-12-28',
  q12: 'Male',
  q12Text: '',
  q13: '725 Fifth Avenue|||New York|||NY|||10022',
  q14: 'Acute Lymphoblastic Leukemia (ALL)',
  q15: '2024-03-15',
  q16: JSON.stringify([
    { firstName: 'Emma', middleInitial: '', lastName: 'Ross', age: '18', relationship: 'Sister' },
    { firstName: 'Ravi', middleInitial: '', lastName: 'Ross', age: '14', relationship: 'Brother' },
    { firstName: 'Zuri', middleInitial: '', lastName: 'Ross', age: '12', relationship: 'Sister' },
    { firstName: 'Jessie', middleInitial: '', lastName: 'Prescott', age: '22', relationship: 'Nanny' },
    { firstName: 'Bertram', middleInitial: '', lastName: 'Winkle', age: '55', relationship: 'Butler' }
  ]),
  q17: 'no',
  q17Text: 'Luke was adopted from a group home in Detroit',
  q18: ['joint'],
  q18Other: '',
  q19: 'yes',
  q19Text: '',
  
  // Step 3: Guardian Information - Legal Mother
  q20: 'Christina',
  q21: 'Ross',
  q22: '725 Fifth Avenue',
  q23: 'New York',
  q24: 'NY',
  q25: '10022',
  q26: 'christina.ross@rossenterprises.com',
  q27: 'Fashion Designer / Supermodel',
  q28: 'yes',
  q28Text: '',
  
  // Step 3: Guardian Information - Legal Father
  q29: 'Morgan',
  q30: 'Ross',
  q31: '725 Fifth Avenue',
  q32: 'New York',
  q33: 'NY',
  q34: '10022',
  q35: 'morgan.ross@rossenterprises.com',
  q36: 'Film Director / Producer',
  q37: 'Mom',
  q37Other: '',
  
  // Step 4: Treatment History
  q38: 'yes',
  q38Text: 'Emma witnessed Luke having a severe reaction during chemotherapy',
  q39: 'yes',
  q39Text: 'Siblings stayed with nanny during extended hospital stays',
  q40: 'Christina Ross (Mother)',
  q41: 'Christina Ross and Jessie Prescott (Nanny)',
  q42: '8 months',
  q43: 'yes',
  q43Text: 'One ICU visit during infection',
  q44: '3 weeks initial admission, multiple shorter stays',
  q45: 'no',
  q45Text: '',
  q46: 'no',
  q46Other: '',
  
  // Step 5: Therapy Requests
  q47: 'yes',
  q47Text: '',
  q48: ['adolescent_child_diagnosed_with_cancer', 'adolescent_sibling'],
  q49: JSON.stringify({ firstName: 'Luke', middleInitial: '', lastName: 'Ross', age: '14', relationship: 'Self (Patient)' }),
  q50: 'need_referral',
  q50Text: '',
  q51: 'yes_with_mental_health_benefits'
}

// ACE (Adverse Childhood Experiences) - 10 questions, Yes/No
// Based on Luke's background (adopted from group home, early childhood instability)
// Questions:
// 1. Verbal abuse from parent
// 2. Physical abuse from parent
// 3. Sexual abuse
// 4. Felt unloved
// 5. Neglect (not enough food, dirty clothes)
// 6. Parents separated/divorced
// 7. Mother abused
// 8. Substance abuse in household
// 9. Mental illness in household
// 10. Incarcerated household member
export const aceSeedData: Record<string, string> = {
  'ace_1': 'Yes',   // Verbal abuse - yes, in group home
  'ace_2': 'No',    // Physical abuse
  'ace_3': 'No',    // Sexual abuse
  'ace_4': 'Yes',   // Felt unloved - yes, before adoption
  'ace_5': 'Yes',   // Neglect - yes, in group home
  'ace_6': 'Yes',   // Parents separated - biological parents
  'ace_7': 'No',    // Mother abused
  'ace_8': 'Yes',   // Substance abuse in household
  'ace_9': 'No',    // Mental illness
  'ace_10': 'No'    // Incarcerated household member
}

// PCL-5 (PTSD Checklist) - 20 questions, 0-4 scale
// Reflects mild-moderate trauma symptoms consistent with adoption/medical experience
export const pclSeedData = {
  worstEvent: 'Initial cancer diagnosis and first hospitalization',
  responses: [
    2, // q1: Disturbing memories
    1, // q2: Disturbing dreams
    1, // q3: Flashbacks
    2, // q4: Upset when reminded
    2, // q5: Physical reactions
    1, // q6: Avoiding memories
    2, // q7: Avoiding reminders
    1, // q8: Trouble remembering
    1, // q9: Negative beliefs
    0, // q10: Blaming self/others
    2, // q11: Negative feelings
    1, // q12: Loss of interest
    1, // q13: Feeling distant
    1, // q14: Trouble with positive feelings
    1, // q15: Irritable behavior
    0, // q16: Taking risks
    2, // q17: Being superalert
    1, // q18: Easily startled
    2, // q19: Difficulty concentrating
    2  // q20: Trouble sleeping
  ]
}

// PHQ-9 (Depression) - 9 questions + difficulty, 0-3 scale
// Mild depression symptoms consistent with adjustment to illness
export const phqSeedData = {
  responses: [
    1, // q1: Little interest/pleasure
    1, // q2: Feeling down
    2, // q3: Sleep problems
    1, // q4: Tired/low energy
    0, // q5: Poor appetite/overeating
    1, // q6: Feeling bad about self
    1, // q7: Trouble concentrating
    0, // q8: Moving/speaking slowly or restless
    0  // q9: Thoughts of self-harm
  ],
  difficulty: 1 // Somewhat difficult
}

// GAD-7 (Anxiety) - 7 questions + difficulty, 0-3 scale
// Moderate anxiety symptoms related to health concerns
export const gadSeedData = {
  g1: 2, // Nervous/anxious
  g2: 2, // Can't stop worrying
  g3: 2, // Worrying too much
  g4: 1, // Trouble relaxing
  g5: 1, // Restless
  g6: 1, // Easily annoyed
  g7: 2, // Feeling afraid
  g8: 1  // Difficulty (somewhat difficult)
}

export function getApplicationSeedData(): ApplicationSeedData | null {
  if (!isDev()) return null
  return applicationSeedData
}

export function getAceSeedData(): Record<string, string> | null {
  if (!isDev()) return null
  return aceSeedData
}

export function getPclSeedData(): typeof pclSeedData | null {
  if (!isDev()) return null
  return pclSeedData
}

export function getPhqSeedData(): typeof phqSeedData | null {
  if (!isDev()) return null
  return phqSeedData
}

export function getGadSeedData(): typeof gadSeedData | null {
  if (!isDev()) return null
  return gadSeedData
}
