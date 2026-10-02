const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../asyncHandler');
const { validate, parseId } = require('../validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { ZONE_NAMES, distanceKm } = require('../domain/zones');
const { computeFare } = require('../domain/fare');
const rideService = require('../services/rideService');

const router = express.Router();
router.use(authenticate, requireRole('PASSENGER'));

const zone = z.enum(ZONE_NAMES);
const rideSchema = z
  .object({
    pickupZone: zone,
    destinationZone: zone,
    seats: z.coerce.number().int().min(1).max(3),
  })
  .refine((d) => d.pickupZone !== d.destinationZone, {
    message: 'Pickup and destination must differ',
    path: ['destinationZone'],
  });

router.get('/estimate', asyncHandler(async (req, res) => {
  const { pickupZone, destinationZone, seats } = validate(rideSchema, req.query);
  const km = distanceKm(pickupZone, destinationZone);
  res.json({
    distanceKm: km,
    solo: computeFare({ distanceKm: km, seats, pooled: false }),
    ifPooled: computeFare({ distanceKm: km, seats, pooled: true }),
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const input = validate(rideSchema, req.body);
  const ride = await rideService.createRide(req.user, input);
  res.status(201).json({ ride });
}));

router.get('/', asyncHandler(async (req, res) => {
  res.json({ rides: await rideService.listPassengerRides(req.user.id) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json({ ride: await rideService.getPassengerRide(req.user.id, parseId(req.params.id)) });
}));

router.post('/:id/cancel', asyncHandler(async (req, res) => {
  res.json({ ride: await rideService.cancelRide(req.user, parseId(req.params.id)) });
}));

module.exports = router;
