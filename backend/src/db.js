const { PrismaClient } = require('@prisma/client');

// The database is remote, so give interactive transactions more room than the 5s default.
const prisma = new PrismaClient({
  transactionOptions: { maxWait: 10000, timeout: 20000 },
});

module.exports = prisma;
