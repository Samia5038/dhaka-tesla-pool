const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../asyncHandler');
const { validate, parseId } = require('../validate');
const { authenticate, requireRole } = require('../middleware/auth');
const rideService = require('../services/rideService');

const router = express.Router();
router.use(authenticate, requireRole('DRIVER'));

router.put('/online', asyncHandler(async (req, res) => {
  const { isOnline } = validate(z.object({ isOnline: z.boolean() }), req.body);
  res.json({ tesla: await rideService.setOnline(req.user, isOnline) });
}));

router.get('/requests', asyncHandler(async (req, res) => {
  res.json({ requests: await rideService.listWaitingRequests(req.user) });
}));

router.post('/requests/:id/accept', asyncHandler(async (req, res) => {
  res.json(await rideService.driverAcceptRide(req.user, parseId(req.params.id)));
}));

router.get('/pool/current', asyncHandler(async (req, res) => {
  res.json(await rideService.getCurrentPool(req.user));
}));

router.post('/pools/:id/:action', asyncHandler(async (req, res) => {
  const { action } = validate(z.object({ action: z.enum(['arrive', 'start', 'complete']) }), req.params);
  res.json(await rideService.advancePool(req.user, parseId(req.params.id), action));
}));

router.get('/history', asyncHandler(async (req, res) => {
  res.json({ pools: await rideService.getDriverHistory(req.user) });
}));

module.exports = router;
