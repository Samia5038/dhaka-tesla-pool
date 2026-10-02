const jwt = require('jsonwebtoken');
const request = require('supertest');
const prisma = require('../src/db');
const app = require('../src/app');

async function resetDb() {
  await prisma.rideStatusHistory.deleteMany();
  await prisma.rideRequest.deleteMany();
  await prisma.pool.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();
}

function tokenFor(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// The story cast: Jashim drives Bullet (3 seats). Nusrat, Rafiq, Shirin are passengers.
async function seedCast() {
  const make = async (name, role) => {
    const user = await prisma.user.create({
      data: { name, email: `${name.toLowerCase()}@teslapool.test`, passwordHash: 'not-used', role },
    });
    return { user, token: tokenFor(user) };
  };
  const jashim = await make('Jashim', 'DRIVER');
  await prisma.vehicle.create({ data: { name: 'Bullet', capacity: 3, driverId: jashim.user.id } });
  return {
    jashim,
    nusrat: await make('Nusrat', 'PASSENGER'),
    rafiq: await make('Rafiq', 'PASSENGER'),
    shirin: await make('Shirin', 'PASSENGER'),
  };
}

// api(token).post('/api/rides', body) -> a supertest request with the auth header set.
function api(token) {
  const withAuth = (req) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  return {
    get: (path) => withAuth(request(app).get(path)),
    post: (path, body) => withAuth(request(app).post(path)).send(body),
    put: (path, body) => withAuth(request(app).put(path)).send(body),
  };
}

module.exports = { resetDb, seedCast, api };
