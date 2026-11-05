import { describe, it, expect, vi, beforeEach } from 'vitest'

// The generated Prisma client doesn't exist until `prisma generate` runs
// against a live engine. Mock it at the module boundary so this test only
// exercises the seeding logic (what gets created vs skipped), not Prisma
// itself. Prisma enums compile down to plain string-keyed objects, so a
// plain object is a faithful stand-in for TagCategory here.
vi.mock('../../prisma/generated/client', () => ({
  TagCategory: { PERSONALITY: 'PERSONALITY', EXPERTISE: 'EXPERTISE' },
}))

import { ensureDefaultTags } from './tag-taxonomy'

type EnsureDefaultTagsPrisma = Parameters<typeof ensureDefaultTags>[0]

function makePrismaMock(existingNames: Set<string>): EnsureDefaultTagsPrisma {
  return {
    tag: {
      findUnique: vi.fn(({ where }: { where: { name_category: { name: string } } }) =>
        existingNames.has(where.name_category.name) ? { id: 'x' } : null
      ),
      create: vi.fn(),
    },
  } as unknown as EnsureDefaultTagsPrisma
}

describe('ensureDefaultTags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates every default tag when none exist yet', async () => {
    const prisma = makePrismaMock(new Set())
    await ensureDefaultTags(prisma)

    expect(prisma.tag.create).toHaveBeenCalled()
    const createdNames = prisma.tag.create.mock.calls.map(
      (call: [{ data: { name: string } }]) => call[0].data.name
    )
    expect(createdNames).toContain('Trauma-informed care')
    expect(createdNames).toContain('Warm and nurturing')
  })

  it('is idempotent: skips tags that already exist', async () => {
    const prisma = makePrismaMock(new Set(['Trauma-informed care']))
    await ensureDefaultTags(prisma)

    const createdNames = prisma.tag.create.mock.calls.map(
      (call: [{ data: { name: string } }]) => call[0].data.name
    )
    expect(createdNames).not.toContain('Trauma-informed care')
    expect(createdNames).toContain('Warm and nurturing')
  })

  it('creates nothing when every default tag already exists', async () => {
    const allNames = new Set([
      'Warm and nurturing',
      'Direct communicator',
      'Structured / goal-oriented',
      'Calm and patient',
      'High energy / playful',
      'Trauma-informed care',
      'Anxiety',
      'Depression',
      'Child & adolescent therapy',
      'Family systems',
      'Grief and loss',
      'Substance use',
    ])
    const prisma = makePrismaMock(allNames)
    await ensureDefaultTags(prisma)

    expect(prisma.tag.create).not.toHaveBeenCalled()
  })
})
