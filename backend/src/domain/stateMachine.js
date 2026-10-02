const HttpError = require('../httpError');

const RIDE_TRANSITIONS = {
  REQUESTED: ['MATCHED', 'CANCELLED'],
  MATCHED: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['STARTED'],
  STARTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

function canTransition(from, to) {
  return (RIDE_TRANSITIONS[from] || []).includes(to);
}

function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new HttpError(409, `Invalid status change: ${from} -> ${to}`);
  }
}

module.exports = { RIDE_TRANSITIONS, canTransition, assertTransition };
