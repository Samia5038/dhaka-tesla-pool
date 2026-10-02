const prisma = require('../db');
const HttpError = require('../httpError');
const { distanceKm, destinationsCompatible } = require('../domain/zones');
const { computeFare } = require('../domain/fare');
const { assertTransition } = require('../domain/stateMachine');

// Rides that currently hold seats in a pool.
const ACTIVE = ['MATCHED', 'DRIVER_ARRIVED', 'STARTED'];
const OPEN_POOL_STATES = ['OPEN', 'DRIVER_ARRIVED', 'STARTED'];

// ---------- helpers ----------

// Locks the Tesla row until the transaction ends. Everything that changes
// seats for this Tesla must take this lock first, so changes happen one at a time.
async function lockVehicle(tx, vehicleId) {
  await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id = ${vehicleId} FOR UPDATE`;
}

// Changes a ride's status. The "where status = from" guard means that if someone
// else changed it first, count is 0 and we fail instead of overwriting.
async function setStatus(tx, ride, to, userId, extra = {}) {
  assertTransition(ride.status, to);
  const { count } = await tx.rideRequest.updateMany({
    where: { id: ride.id, status: ride.status },
    data: { status: to, ...extra },
  });
  if (count === 0) throw new HttpError(409, 'Ride was changed by someone else, please retry');
  await tx.rideStatusHistory.create({
    data: { rideRequestId: ride.id, fromStatus: ride.status, toStatus: to, changedById: userId },
  });
}

// Returns an error message if the ride cannot join, otherwise null.
function fitProblem(activeRides, capacity, ride) {
  const occupied = activeRides.reduce((sum, r) => sum + r.seats, 0);
  if (occupied + ride.seats > capacity) return 'Not enough free seats in this Tesla';
  const compatible = activeRides.every((r) =>
    destinationsCompatible(r.destinationZone, ride.destinationZone)
  );
  if (!compatible) return 'Destination is not compatible with this pool';
  return null;
}

// Pool discount applies when 2+ passengers share. Recalculate everyone's fare.
async function recomputeFares(tx, poolId) {
  const rides = await tx.rideRequest.findMany({ where: { poolId, status: { in: ACTIVE } } });
  const pooled = rides.length >= 2;
  for (const r of rides) {
    const km = distanceKm(r.pickupZone, r.destinationZone);
    const { total } = computeFare({ distanceKm: km, seats: r.seats, pooled });
    if (total !== r.farePaisa) {
      await tx.rideRequest.update({ where: { id: r.id }, data: { farePaisa: total } });
    }
  }
}

// THE concurrency-safe step: lock first, then re-check everything, then write.
async function joinPool(tx, ride, pool, userId) {
  await lockVehicle(tx, pool.vehicleId);

  const fresh = await tx.pool.findUnique({
    where: { id: pool.id },
    include: { vehicle: true, rides: { where: { status: { in: ACTIVE } } } },
  });
  if (!fresh || fresh.status !== 'OPEN') throw new HttpError(409, 'Pool is no longer open');
  if (fresh.pickupZone !== ride.pickupZone) {
    throw new HttpError(409, 'Pickup zone differs from this pool');
  }
  const problem = fitProblem(fresh.rides, fresh.vehicle.capacity, ride);
  if (problem) throw new HttpError(409, problem);

  await setStatus(tx, ride, 'MATCHED', userId, { poolId: fresh.id });
  await recomputeFares(tx, fresh.id);
}

// Cheap, unlocked look for a pool the ride might fit. joinPool re-checks properly.
async function findJoinablePool(tx, ride) {
  const pools = await tx.pool.findMany({
    where: { status: 'OPEN', pickupZone: ride.pickupZone, vehicle: { isOnline: true } },
    include: { vehicle: true, rides: { where: { status: { in: ACTIVE } } } },
    orderBy: { createdAt: 'asc' },
  });
  return pools.find((p) => !fitProblem(p.rides, p.vehicle.capacity, ride)) || null;
}

// ---------- views (what each person is allowed to see) ----------

const rideInclude = {
  pool: { select: { id: true, vehicle: { select: { name: true } } } },
  history: { orderBy: { createdAt: 'asc' } },
};

function rideView(r) {
  const km = distanceKm(r.pickupZone, r.destinationZone);
  const solo = computeFare({ distanceKm: km, seats: r.seats, pooled: false }).total;
  return {
    id: r.id,
    status: r.status,
    pickupZone: r.pickupZone,
    destinationZone: r.destinationZone,
    seats: r.seats,
    distanceKm: km,
    farePaisa: r.farePaisa,
    poolDiscountPaisa: Math.max(0, solo - r.farePaisa),
    tesla: r.pool ? r.pool.vehicle.name : null,
    poolId: r.poolId,
    createdAt: r.createdAt,
    timeline: (r.history || []).map((h) => ({ status: h.toStatus, at: h.createdAt })),
  };
}

// ---------- passenger actions ----------

async function createRide(user, { pickupZone, destinationZone, seats }) {
  const km = distanceKm(pickupZone, destinationZone);
  const estimate = computeFare({ distanceKm: km, seats, pooled: false });

  // Transaction 1: save the request, so it exists even if matching fails.
  const ride = await prisma.$transaction(async (tx) => {
    const created = await tx.rideRequest.create({
      data: { passengerId: user.id, pickupZone, destinationZone, seats, farePaisa: estimate.total },
    });
    await tx.rideStatusHistory.create({
      data: { rideRequestId: created.id, fromStatus: null, toStatus: 'REQUESTED', changedById: user.id },
    });
    return created;
  });

  // Transaction 2: try to join an open pool. Losing a race is fine: stay REQUESTED.
  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.rideRequest.findUnique({ where: { id: ride.id } });
      const pool = await findJoinablePool(tx, fresh);
      if (pool) await joinPool(tx, fresh, pool, user.id);
    });
  } catch (err) {
    if (!(err instanceof HttpError && err.status === 409)) throw err;
  }

  return getPassengerRide(user.id, ride.id);
}

async function listPassengerRides(userId) {
  const rides = await prisma.rideRequest.findMany({
    where: { passengerId: userId },
    include: rideInclude,
    orderBy: { createdAt: 'desc' },
  });
  return rides.map(rideView);
}

// Looking up by id AND passengerId means other people's rides simply "don't exist" (404).
async function getPassengerRide(userId, rideId) {
  const ride = await prisma.rideRequest.findFirst({
    where: { id: rideId, passengerId: userId },
    include: rideInclude,
  });
  if (!ride) throw new HttpError(404, 'Ride not found');
  return rideView(ride);
}

async function cancelRide(user, rideId) {
  await prisma.$transaction(async (tx) => {
    const ride = await tx.rideRequest.findFirst({
      where: { id: rideId, passengerId: user.id },
      include: { pool: true },
    });
    if (!ride) throw new HttpError(404, 'Ride not found');

    if (ride.pool) await lockVehicle(tx, ride.pool.vehicleId);
    const current = await tx.rideRequest.findUnique({ where: { id: rideId } });

    await setStatus(tx, current, 'CANCELLED', user.id);
    if (current.poolId) await recomputeFares(tx, current.poolId);
  });
  return getPassengerRide(user.id, rideId);
}

// ---------- driver actions ----------

async function getVehicleOf(driverId) {
  const vehicle = await prisma.vehicle.findUnique({ where: { driverId } });
  if (!vehicle) throw new HttpError(404, 'No Tesla registered for this driver');
  return vehicle;
}

async function setOnline(driver, isOnline) {
  const vehicle = await getVehicleOf(driver.id);
  if (!isOnline) {
    const busy = await prisma.pool.findFirst({
      where: {
        vehicleId: vehicle.id,
        status: { in: OPEN_POOL_STATES },
        rides: { some: { status: { in: ACTIVE } } },
      },
    });
    if (busy) throw new HttpError(409, 'Finish your current pool before going offline');
  }
  const updated = await prisma.vehicle.update({ where: { id: vehicle.id }, data: { isOnline } });
  return { name: updated.name, capacity: updated.capacity, isOnline: updated.isOnline };
}

async function listWaitingRequests(driver) {
  const vehicle = await getVehicleOf(driver.id);
  const pool = await prisma.pool.findFirst({
    where: { vehicleId: vehicle.id, status: 'OPEN', rides: { some: { status: { in: ACTIVE } } } },
  });
  const rides = await prisma.rideRequest.findMany({
    where: {
      status: 'REQUESTED',
      seats: { lte: vehicle.capacity },
      ...(pool ? { pickupZone: pool.pickupZone } : {}),
    },
    include: { passenger: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return rides.map((r) => ({
    id: r.id,
    passengerName: r.passenger.name,
    pickupZone: r.pickupZone,
    destinationZone: r.destinationZone,
    seats: r.seats,
    createdAt: r.createdAt,
  }));
}

async function driverAcceptRide(driver, rideId) {
  const poolId = await prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.findUnique({ where: { driverId: driver.id } });
    if (!vehicle) throw new HttpError(404, 'No Tesla registered for this driver');
    if (!vehicle.isOnline) throw new HttpError(409, 'Go online first');

    const ride = await tx.rideRequest.findUnique({ where: { id: rideId } });
    if (!ride) throw new HttpError(404, 'Ride not found');
    if (ride.status !== 'REQUESTED') throw new HttpError(409, 'Ride is no longer waiting');

    await lockVehicle(tx, vehicle.id);

    let pool = await tx.pool.findFirst({
      where: { vehicleId: vehicle.id, status: { in: OPEN_POOL_STATES } },
    });
    if (pool && pool.status !== 'OPEN') {
      throw new HttpError(409, 'Finish your current trip first');
    }
    if (!pool) {
      pool = await tx.pool.create({ data: { vehicleId: vehicle.id, pickupZone: ride.pickupZone } });
    } else {
      // An OPEN pool with nobody in it can move to the new pickup zone.
      const riders = await tx.rideRequest.count({ where: { poolId: pool.id, status: { in: ACTIVE } } });
      if (riders === 0 && pool.pickupZone !== ride.pickupZone) {
        pool = await tx.pool.update({ where: { id: pool.id }, data: { pickupZone: ride.pickupZone } });
      }
    }

    await joinPool(tx, ride, pool, driver.id);
    return pool.id;
  });
  return { poolId };
}

const POOL_STEPS = {
  arrive: { from: 'OPEN', to: 'DRIVER_ARRIVED' },
  start: { from: 'DRIVER_ARRIVED', to: 'STARTED' },
  complete: { from: 'STARTED', to: 'COMPLETED' },
};

// Moves the whole pool (and every active passenger in it) to the next stage.
async function advancePool(driver, poolId, action) {
  const step = POOL_STEPS[action];
  await prisma.$transaction(async (tx) => {
    const pool = await tx.pool.findUnique({ where: { id: poolId }, include: { vehicle: true } });
    if (!pool) throw new HttpError(404, 'Pool not found');
    if (pool.vehicle.driverId !== driver.id) throw new HttpError(403, 'This is not your pool');

    await lockVehicle(tx, pool.vehicleId);
    const fresh = await tx.pool.findUnique({ where: { id: poolId } });
    if (fresh.status !== step.from) {
      throw new HttpError(409, `Cannot ${action}: pool is ${fresh.status}, expected ${step.from}`);
    }

    const rides = await tx.rideRequest.findMany({ where: { poolId, status: { in: ACTIVE } } });
    if (rides.length === 0) throw new HttpError(409, 'No passengers in this pool');

    for (const r of rides) await setStatus(tx, r, step.to, driver.id);
    await tx.pool.update({ where: { id: poolId }, data: { status: step.to } });
  });
  return getCurrentPool(driver, poolId);
}

async function getCurrentPool(driver, specificPoolId) {
  const vehicle = await getVehicleOf(driver.id);
  const pool = await prisma.pool.findFirst({
    where: specificPoolId
      ? { id: specificPoolId, vehicleId: vehicle.id }
      : { vehicleId: vehicle.id, status: { in: OPEN_POOL_STATES } },
    include: {
      rides: {
        where: specificPoolId ? {} : { status: { in: ACTIVE } },
        include: { passenger: { select: { name: true } } },
      },
    },
  });
  const tesla = { name: vehicle.name, capacity: vehicle.capacity, isOnline: vehicle.isOnline };
  if (!pool) return { tesla, pool: null };

  const seatsOccupied = pool.rides
    .filter((r) => ACTIVE.includes(r.status))
    .reduce((sum, r) => sum + r.seats, 0);
  return {
    tesla,
    pool: {
      id: pool.id,
      status: pool.status,
      pickupZone: pool.pickupZone,
      seatsOccupied,
      seatsTotal: vehicle.capacity,
      passengers: pool.rides.map((r) => ({
        rideId: r.id,
        name: r.passenger.name,
        seats: r.seats,
        destinationZone: r.destinationZone,
        status: r.status,
        farePaisa: r.farePaisa,
      })),
    },
  };
}

async function getDriverHistory(driver) {
  const vehicle = await getVehicleOf(driver.id);
  const pools = await prisma.pool.findMany({
    where: { vehicleId: vehicle.id, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { rides: { include: { passenger: { select: { name: true } } } } },
  });
  return pools.map((p) => ({
    poolId: p.id,
    pickupZone: p.pickupZone,
    createdAt: p.createdAt,
    passengers: p.rides
      .filter((r) => r.status === 'COMPLETED')
      .map((r) => ({ name: r.passenger.name, destinationZone: r.destinationZone, seats: r.seats, farePaisa: r.farePaisa })),
  }));
}

module.exports = {
  createRide, listPassengerRides, getPassengerRide, cancelRide,
  setOnline, listWaitingRequests, driverAcceptRide, advancePool, getCurrentPool, getDriverHistory,
};
