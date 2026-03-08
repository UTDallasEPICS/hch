import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from './generated/client'
import { joinName } from '../server/utils/name'

const connectionString = process.env.DATABASE_URL ?? 'file:./dev.db'
const adapter = new PrismaBetterSqlite3({ url: connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Start seeding...')

  // Assign roles and names: alice@a.com and djanjanam@gmail.com = ADMIN, bob@b.com = CLIENT
  const userNames: Record<string, { fname: string; lname: string }> = {
    'bob@b.com': { fname: 'bob', lname: 'builder' },
    'alice@a.com': { fname: 'Alice', lname: 'wonderland' },
  }
  const adminEmails = ['alice@a.com', 'djanjanam@gmail.com']
  const clientEmail = 'bob@b.com'
  for (const email of adminEmails) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) {
      const names = userNames[email]
      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'ADMIN',
          ...(names ? { name: joinName(names.fname, names.lname) } : {}),
        },
      })
      console.log(`Set ${email} as ADMIN${names ? ` (${names.fname} ${names.lname})` : ''}`)
    }
  }
  const clientUser = await prisma.user.findUnique({ where: { email: clientEmail } })
  if (clientUser) {
    const names = userNames[clientEmail]
    await prisma.user.update({
      where: { id: clientUser.id },
      data: {
        role: 'CLIENT',
        ...(names ? { name: joinName(names.fname, names.lname) } : {}),
      },
    })
    console.log(`Set ${clientEmail} as CLIENT${names ? ` (${names.fname} ${names.lname})` : ''}`)
  }

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
