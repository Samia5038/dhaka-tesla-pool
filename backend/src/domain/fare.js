// All money is stored as integer paisa (1 taka = 100 paisa) to avoid floating point errors.
const BASE_FARE_PAISA = 4000;
const PER_KM_PAISA = 1500;
const POOL_DISCOUNT_PERCENT = 20;

function computeFare({ distanceKm, seats, pooled }) {
  const baseFare = BASE_FARE_PAISA * seats;
  const distanceCharge = PER_KM_PAISA * distanceKm * seats;
  const subtotal = baseFare + distanceCharge;
  const poolDiscount = pooled ? Math.floor((subtotal * POOL_DISCOUNT_PERCENT) / 100) : 0;
  return { baseFare, distanceCharge, poolDiscount, total: subtotal - poolDiscount };
}

module.exports = { BASE_FARE_PAISA, PER_KM_PAISA, POOL_DISCOUNT_PERCENT, computeFare };
