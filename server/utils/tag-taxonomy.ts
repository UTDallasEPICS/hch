import type { PrismaClient } from '../../prisma/generated/client'
import { TagCategory } from '../../prisma/generated/client'

/**
 * Starter tag vocabulary for clinician-client matching (REQ-F-05).
 *
 * This is a first-pass list, not a clinical standard — expect it to be
 * edited through the tag management UI (REQ-F-05a.2) once that exists.
 * Keeping it here (rather than only in migration SQL) makes it visible in
 * code review and easy to extend.
 */
const DEFAULT_PERSONALITY_TAGS = [
  'Warm and nurturing',
  'Direct communicator',
  'Structured / goal-oriented',
  'Calm and patient',
  'High energy / playful',
]

const DEFAULT_EXPERTISE_TAGS = [
  'Trauma-informed care',
  'Anxiety',
  'Depression',
  'Child & adolescent therapy',
  'Family systems',
  'Grief and loss',
  'Substance use',
]

/**
 * Ensures the default tag vocabulary exists. Idempotent — matches existing
 * tags by (name, category) and only creates what's missing, so it's safe to
 * run on every deploy alongside the other reference-data seeders.
 */
export async function ensureDefaultTags(prisma: PrismaClient): Promise<void> {
  const seedList: { name: string; category: TagCategory }[] = [
    ...DEFAULT_PERSONALITY_TAGS.map((name) => ({ name, category: TagCategory.PERSONALITY })),
    ...DEFAULT_EXPERTISE_TAGS.map((name) => ({ name, category: TagCategory.EXPERTISE })),
  ]

  for (const { name, category } of seedList) {
    const existing = await prisma.tag.findUnique({
      where: { name_category: { name, category } },
    })
    if (!existing) {
      await prisma.tag.create({ data: { name, category } })
    }
  }
}
