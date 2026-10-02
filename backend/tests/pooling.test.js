const prisma = require('../src/db');
const { resetDb, seedCast, api } = require('./helpers');

let cast;

beforeEach(async () => {
  await resetDb();
  cast = await seedCast();
  await api(cast.jashim.token).put('/api/driver/online', { isOnline: true });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const NUSRAT_TRIP = { pickupZone: 'Banani', destinationZone: 'Mohakhali', seats: 1 };
const RAFIQ_TRIP = { pickupZone: 'Banani', destinationZone: 'Gulshan 1', seats: 1 };

async function requestRide(person, body) {
  const res = await api(person.token).post('/api/rides', body);
  expect(res.status).toBe(201);
  return res.body.ride;
}

async function jashimAccepts(ride) {
  const res = await api(cast.jashim.token).post(`/api/driver/requests/${ride.id}/accept`);
  expect(res.status).toBe(200);
  return res.body.poolId;
}

async function seatsOccupied() {
  const sum = await prisma.rideRequest.aggregate({
    _sum: { seats: true },
    where: { status: { in: ['MATCHED', 'DRIVER_ARRIVED', 'STARTED'] } },
  });
  return sum._sum.seats || 0;
}

async function myRide(person, id) {
  const res = await api(person.token).get(`/api/rides/${id}`);
  return res.body.ride;
}

describe('pooled fares for Nusrat and Rafiq', () => {
  test('Nusrat pays 8500 alone, then 6800 once Rafiq (9200) shares Bullet', async () => {
    const nusrat = await requestRide(cast.nusrat, NUSRAT_TRIP);
    expect(nusrat.status).toBe('REQUESTED');
    expect(nusrat.farePaisa).toBe(8500);

    await jashimAccepts(nusrat);
    const rafiq = await requestRide(cast.rafiq, RAFIQ_TRIP);

    expect(rafiq.status).toBe('MATCHED');
    expect(rafiq.farePaisa).toBe(9200);
    expect((await myRide(cast.nusrat, nusrat.id)).farePaisa).toBe(6800);
  });
});

describe('capacity', () => {
  test('a 2-seat request waits when only 1 seat is left', async () => {
    await jashimAccepts(await requestRide(cast.nusrat, NUSRAT_TRIP));
    await requestRide(cast.rafiq, RAFIQ_TRIP);

    const shirin = await requestRide(cast.shirin, { ...NUSRAT_TRIP, seats: 2 });
    expect(shirin.status).toBe('REQUESTED');
    expect(await seatsOccupied()).toBe(2);
  });

  test('driver cannot accept a request that does not fit', async () => {
    await jashimAccepts(await requestRide(cast.nusrat, NUSRAT_TRIP));
    await requestRide(cast.rafiq, RAFIQ_TRIP);
    const shirin = await requestRide(cast.shirin, { ...NUSRAT_TRIP, seats: 2 });

    const res = await api(cast.jashim.token).post(`/api/driver/requests/${shirin.id}/accept`);
    expect(res.status).toBe(409);
    expect(await seatsOccupied()).toBe(2);
  });
});

describe('concurrency: one seat left, two passengers at once', () => {
  test('Nusrat and Shirin race for the last seat, only one gets it', async () => {
    // Rafiq takes 2 seats, so Bullet has exactly 1 seat left.
    await jashimAccepts(await requestRide(cast.rafiq, { ...RAFIQ_TRIP, seats: 2 }));

    const [a, b] = await Promise.all([
      api(cast.nusrat.token).post('/api/rides', NUSRAT_TRIP),
      api(cast.shirin.token).post('/api/rides', NUSRAT_TRIP),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const statuses = [a.body.ride.status, b.body.ride.status].sort();
    expect(statuses).toEqual(['MATCHED', 'REQUESTED']);
    expect(await seatsOccupied()).toBe(3);
  });
});

describe('ride lifecycle', () => {
  test('rejects skipping steps and repeating the final step', async () => {
    const poolId = await jashimAccepts(await requestRide(cast.nusrat, NUSRAT_TRIP));
    const driver = api(cast.jashim.token);

    expect((await driver.post(`/api/driver/pools/${poolId}/complete`)).status).toBe(409);
    expect((await driver.post(`/api/driver/pools/${poolId}/start`)).status).toBe(409);

    expect((await driver.post(`/api/driver/pools/${poolId}/arrive`)).status).toBe(200);
    expect((await driver.post(`/api/driver/pools/${poolId}/start`)).status).toBe(200);
    expect((await driver.post(`/api/driver/pools/${poolId}/complete`)).status).toBe(200);
    expect((await driver.post(`/api/driver/pools/${poolId}/complete`)).status).toBe(409);
  });

  test('all passengers in the pool move together', async () => {
    const nusrat = await requestRide(cast.nusrat, NUSRAT_TRIP);
    const poolId = await jashimAccepts(nusrat);
    const rafiq = await requestRide(cast.rafiq, RAFIQ_TRIP);

    await api(cast.jashim.token).post(`/api/driver/pools/${poolId}/arrive`);
    expect((await myRide(cast.nusrat, nusrat.id)).status).toBe('DRIVER_ARRIVED');
    expect((await myRide(cast.rafiq, rafiq.id)).status).toBe('DRIVER_ARRIVED');
  });
});

describe('who can touch what', () => {
  test("Rafiq cannot see or cancel Nusrat's ride", async () => {
    const nusrat = await requestRide(cast.nusrat, NUSRAT_TRIP);

    expect((await api(cast.rafiq.token).get(`/api/rides/${nusrat.id}`)).status).toBe(404);
    expect((await api(cast.rafiq.token).post(`/api/rides/${nusrat.id}/cancel`)).status).toBe(404);
    expect((await myRide(cast.nusrat, nusrat.id)).status).toBe('REQUESTED');
  });

  test('passengers cannot use driver endpoints, and no token means 401', async () => {
    expect((await api(cast.nusrat.token).put('/api/driver/online', { isOnline: true })).status).toBe(403);
    expect((await api(null).get('/api/rides')).status).toBe(401);
  });
});

describe('cancellation rules', () => {
  test('cancelling frees the seat and removes the pool discount', async () => {
    const nusrat = await requestRide(cast.nusrat, NUSRAT_TRIP);
    await jashimAccepts(nusrat);
    const rafiq = await requestRide(cast.rafiq, RAFIQ_TRIP);
    expect(await seatsOccupied()).toBe(2);

    const res = await api(cast.rafiq.token).post(`/api/rides/${rafiq.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.ride.status).toBe('CANCELLED');
    expect(await seatsOccupied()).toBe(1);
    expect((await myRide(cast.nusrat, nusrat.id)).farePaisa).toBe(8500);
  });

  test('cannot cancel twice, or after the driver arrived', async () => {
    const nusrat = await requestRide(cast.nusrat, NUSRAT_TRIP);
    const poolId = await jashimAccepts(nusrat);

    await api(cast.jashim.token).post(`/api/driver/pools/${poolId}/arrive`);
    expect((await api(cast.nusrat.token).post(`/api/rides/${nusrat.id}/cancel`)).status).toBe(409);

    const shirin = await requestRide(cast.shirin, { ...NUSRAT_TRIP, seats: 1 });
    expect((await api(cast.shirin.token).post(`/api/rides/${shirin.id}/cancel`)).status).toBe(200);
    expect((await api(cast.shirin.token).post(`/api/rides/${shirin.id}/cancel`)).status).toBe(409);
  });
});
