import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existingCount = await prisma.subject.count();
  if (existingCount > 0) {
    console.log('Database already seeded.');
    return;
  }

  await prisma.subject.createMany({
    data: [
      { name: 'Personal & Errands', code: 'PERS', colorHex: '#EC4899' },
      { name: 'College & Academics', code: 'ACAD', colorHex: '#3B82F6' },
      { name: 'Work & Career', code: 'WORK', colorHex: '#10B981' },
      { name: 'Finance & Bills', code: 'FIN', colorHex: '#F59E0B' },
      { name: 'Health & Fitness', code: 'HLTH', colorHex: '#EF4444' },
      { name: 'Side Projects', code: 'PROJ', colorHex: '#8B5CF6' },
    ],
  });

  console.log('Seeded initial categories successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
