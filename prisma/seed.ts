import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from './generated/client'
import {
  ensureDefaultDeclarationTemplates,
  backfillSessionNotesRequestTemplates,
} from '../server/utils/declaration-templates'

const connectionString = process.env.DATABASE_URL ?? 'file:./dev.db'
const adapter = new PrismaBetterSqlite3({ url: connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Start seeding...')

  // Reference data only. This seed is idempotent and safe to run on every
  // deploy: it creates the declaration templates if missing and backfills
  // existing rows, but never creates or overwrites user data. Admins are no
  // longer seeded — the first person to sign in on an empty DB becomes the
  // ADMIN (see server/utils/auth.ts databaseHooks.user.create.before).
  await ensureDefaultDeclarationTemplates(prisma)
  await backfillSessionNotesRequestTemplates(prisma)

  console.log('Seeding finished.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
