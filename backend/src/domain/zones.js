const ZONES = {
  'Banani': { x: 0, y: 0 },
  'Mohakhali': { x: 1, y: -2 },
  'Gulshan 1': { x: 3, y: -2 },
  'Farmgate': { x: -2, y: -4 },
  'Dhanmondi': { x: -4, y: -6 },
  'Mirpur': { x: -6, y: 2 },
  'Uttara': { x: 2, y: 9 },
  'Bashundhara': { x: 6, y: 3 },
};

const ZONE_NAMES = Object.keys(ZONES);

// Two destinations can share a Tesla only if they are this close (km).
const MAX_DESTINATION_GAP_KM = 3;

// Manhattan distance on the zone grid, always whole km.
function distanceKm(a, b) {
  return Math.abs(ZONES[a].x - ZONES[b].x) + Math.abs(ZONES[a].y - ZONES[b].y);
}

function destinationsCompatible(a, b) {
  return distanceKm(a, b) <= MAX_DESTINATION_GAP_KM;
}

module.exports = { ZONES, ZONE_NAMES, MAX_DESTINATION_GAP_KM, distanceKm, destinationsCompatible };
