const { computeFare } = require('../src/domain/fare');
const { assertTransition } = require('../src/domain/stateMachine');

describe('fare model (paisa, integer)', () => {
  test('Nusrat: Banani -> Mohakhali is 3 km, solo 8500, pooled 6800', () => {
    expect(computeFare({ distanceKm: 3, seats: 1, pooled: false }).total).toBe(8500);
    const pooled = computeFare({ distanceKm: 3, seats: 1, pooled: true });
    expect(pooled.poolDiscount).toBe(1700);
    expect(pooled.total).toBe(6800);
  });

  test('Rafiq: Banani -> Gulshan 1 is 5 km, solo 11500, pooled 9200', () => {
    expect(computeFare({ distanceKm: 5, seats: 1, pooled: false }).total).toBe(11500);
    expect(computeFare({ distanceKm: 5, seats: 1, pooled: true }).total).toBe(9200);
  });

  test('fare scales with seats and stays an integer', () => {
    const fare = computeFare({ distanceKm: 3, seats: 2, pooled: true });
    expect(fare.total).toBe(13600);
    expect(Number.isInteger(fare.total)).toBe(true);
  });
});

describe('ride state machine', () => {
  test('allows the normal path', () => {
    expect(() => assertTransition('REQUESTED', 'MATCHED')).not.toThrow();
    expect(() => assertTransition('MATCHED', 'DRIVER_ARRIVED')).not.toThrow();
    expect(() => assertTransition('DRIVER_ARRIVED', 'STARTED')).not.toThrow();
    expect(() => assertTransition('STARTED', 'COMPLETED')).not.toThrow();
  });

  test('rejects skipping and going backwards', () => {
    expect(() => assertTransition('REQUESTED', 'STARTED')).toThrow();
    expect(() => assertTransition('COMPLETED', 'STARTED')).toThrow();
    expect(() => assertTransition('CANCELLED', 'MATCHED')).toThrow();
  });

  test('no cancelling once the driver has arrived', () => {
    expect(() => assertTransition('DRIVER_ARRIVED', 'CANCELLED')).toThrow();
  });
});
