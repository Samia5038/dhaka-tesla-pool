const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Safety: tests wipe tables, so they must never touch the dev database.
const root = path.join(__dirname, '..');
const testFile = path.join(root, '.env.test');

if (!fs.existsSync(testFile)) {
  throw new Error('backend/.env.test is missing. Tests must run on a separate test database.');
}
const testEnv = dotenv.parse(fs.readFileSync(testFile));

const devFile = path.join(root, '.env');
if (fs.existsSync(devFile)) {
  const devEnv = dotenv.parse(fs.readFileSync(devFile));
  if (devEnv.DATABASE_URL && devEnv.DATABASE_URL === testEnv.DATABASE_URL) {
    throw new Error('.env.test points at the dev database. Use a separate Neon branch.');
  }
}

Object.assign(process.env, testEnv);
