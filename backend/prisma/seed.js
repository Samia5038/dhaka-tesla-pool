const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const jashim = await prisma.user.upsert({
    where: { email: 'jashim@teslapool.test' },
    update: {},
    create: { name: 'Jashim', email: 'jashim@teslapool.test', passwordHash, role: 'DRIVER' },
  });

  await prisma.vehicle.upsert({
    where: { driverId: jashim.id },
    update: {},
    create: { name: 'Bullet', capacity: 3, driverId: jashim.id },
  });

  for (const name of ['Nusrat', 'Rafiq', 'Shirin']) {
    const email = `${name.toLowerCase()}@teslapool.test`;
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { name, email, passwordHash, role: 'PASSENGER' },
    });
  }

  console.log('Seeded: Jashim + Bullet, Nusrat, Rafiq, Shirin');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
