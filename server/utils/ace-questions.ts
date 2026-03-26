/**
 * ACE (Adverse Childhood Experiences) Questionnaire questions.
 * Stored in code (not in database) — source of truth for ACE form.
 */

export const ACE_QUESTIONS = [
  'Did a parent or other adult in the household often swear at you, insult you, put you down, or humiliate you?',
  'Did a parent or other adult in the household often push, grab, slap, or throw something at you?',
  'Did an adult or person at least 5 years older ever touch or fondle you or have you touch their body in a sexual way?',
  'Did you often feel that no one in your family loved you or thought you were important or special?',
  "Did you often feel that you didn't have enough to eat, had to wear dirty clothes, and had no one to protect you?",
  'Were your parents ever separated or divorced?',
  'Was your mother or stepmother often pushed, grabbed, slapped, or had something thrown at her?',
  'Did you live with anyone who was a problem drinker or alcoholic or who used street drugs?',
  'Was a household member depressed or mentally ill, or did a household member attempt suicide?',
  'Did a household member go to prison?',
] as const

export function getAceFormQuestions(): Array<{
  id: string
  text: string
  type: string
  alias: string
  order: number
}> {
  return ACE_QUESTIONS.map((text, i) => ({
    id: `ace_${i + 1}`,
    text,
    type: 'radio',
    alias: `ace_${i + 1}`,
    order: i + 1,
  }))
}
