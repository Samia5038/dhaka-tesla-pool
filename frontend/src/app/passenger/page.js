'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Car,
  Loader2,
  MapPin,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';

import Shell from '@/components/Shell';
import Alert from '@/components/Alert';
import StatusBadge from '@/components/StatusBadge';
import StatusStepper from '@/components/StatusStepper';

import { api } from '@/lib/api';
import { taka, timeOf } from '@/lib/format';
import { useSession } from '@/lib/useSession';
import { usePolling } from '@/lib/usePolling';
import { ZONES } from '@/lib/zones';

const STATUS_STEPS = [
  'REQUESTED',
  'MATCHED',
  'DRIVER_ARRIVED',
  'STARTED',
  'COMPLETED',
];

function labelize(value) {
  return value
    ?.toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function SelectField({
  label,
  value,
  onChange,
  children,
  disabled,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-300">
        {label}
      </span>

      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="input w-full"
      >
        {children}
      </select>
    </label>
  );
}

function RideStatus({ ride }) {
  if (!ride) return null;

  const cancelled = ride.status === 'CANCELLED';

  return (
    <div className="mt-6 glass rounded-3xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Current ride
          </p>

          <h2 className="mt-1 text-xl font-bold">
            {ride.pickupZone}

            <ArrowRight className="mx-2 inline h-4 w-4 text-slate-500" />

            {ride.destinationZone}
          </h2>
        </div>

        <StatusBadge status={ride.status} />
      </div>

      {!cancelled && (
        <div className="mt-6">
          <StatusStepper
            status={ride.status}
            steps={STATUS_STEPS}
          />
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white/5 p-4">
          <p className="text-xs text-slate-500">
            Seats
          </p>

          <p className="mt-1 flex items-center gap-2 font-semibold">
            <Users className="h-4 w-4" />
            {ride.seats}
          </p>
        </div>

        <div className="rounded-2xl bg-white/5 p-4">
          <p className="text-xs text-slate-500">
            Distance
          </p>

          <p className="mt-1 font-semibold">
            {ride.distanceKm} km
          </p>
        </div>

        <div className="rounded-2xl bg-white/5 p-4">
          <p className="text-xs text-slate-500">
            Fare
          </p>

          <p className="mt-1 font-semibold text-emerald-300">
            {taka(ride.farePaisa)}
          </p>
        </div>

        <div className="rounded-2xl bg-white/5 p-4">
          <p className="text-xs text-slate-500">
            Tesla
          </p>

          <p className="mt-1 font-semibold">
            {ride.tesla || 'Waiting for driver'}
          </p>
        </div>
      </div>

      {ride.poolId && (
        <div className="mt-4 rounded-2xl border border-cyan-400/10 bg-cyan-400/5 p-4">
          <p className="text-sm font-medium text-cyan-200">
            You are matched with a Tesla pool.
          </p>

          {ride.poolDiscountPaisa > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              Pool discount:{' '}
              {taka(ride.poolDiscountPaisa)}
            </p>
          )}
        </div>
      )}

      {!['COMPLETED', 'CANCELLED'].includes(ride.status) && (
        <CancelButton rideId={ride.id} />
      )}
    </div>
  );
}

function CancelButton({ rideId }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { session } = useSession('PASSENGER');
  const token = session?.token;

  async function cancel() {
    if (!window.confirm('Cancel this ride?')) {
      return;
    }

    setError('');
    setBusy(true);

    try {
      await api(`/rides/${rideId}/cancel`, {
        method: 'POST',
        token,
      });

      /*
       * Reload is kept here so the cancellation is reflected
       * immediately. The normal polling will also pick it up.
       */
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="mt-5">
      {error && (
        <p className="mb-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        className="btn w-full border border-red-400/20 bg-red-400/10 text-red-300 hover:bg-red-400/20 sm:w-auto"
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Cancelling...
          </>
        ) : (
          <>
            <X className="mr-2 inline h-4 w-4" />
            Cancel ride
          </>
        )}
      </button>
    </div>
  );
}

export default function PassengerPage() {
  const { session, logout } = useSession('PASSENGER');

  const token = session?.token;

  const [pickupZone, setPickupZone] = useState('');
  const [destinationZone, setDestinationZone] = useState('');
  const [seats, setSeats] = useState('1');

  const [estimate, setEstimate] = useState(null);
  const [rides, setRides] = useState([]);

  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadingRides, setLoadingRides] = useState(true);

  const [error, setError] = useState('');

  /*
   * The currently active ride.
   *
   * Completed and cancelled rides are excluded because
   * they should remain in history instead of the active card.
   */
  const currentRide =
    rides.find(
      (ride) =>
        !['COMPLETED', 'CANCELLED'].includes(ride.status)
    ) || null;

  /*
   * Loads all rides belonging to this passenger.
   */
  const loadRides = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const data = await api('/rides', {
        token,
      });

      setRides(data.rides || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingRides(false);
    }
  }, [token]);

  /*
   * LIVE PASSENGER UPDATES
   *
   * Runs immediately when the token becomes available,
   * then checks the backend every 2 seconds.
   *
   * Example:
   *
   * Driver accepts passenger
   *        ↓
   * Backend changes REQUESTED → MATCHED
   *        ↓
   * Passenger polling sees new status
   *        ↓
   * UI changes automatically
   */
  usePolling(
    loadRides,
    2000,
    Boolean(token)
  );

  async function getEstimate() {
    if (!pickupZone || !destinationZone) {
      setError(
        'Select pickup and destination first.'
      );
      return;
    }

    if (pickupZone === destinationZone) {
      setError(
        'Pickup and destination must be different.'
      );
      return;
    }

    setError('');
    setLoadingEstimate(true);

    try {
      const params = new URLSearchParams({
        pickupZone,
        destinationZone,
        seats,
      });

      const data = await api(
        `/rides/estimate?${params.toString()}`,
        {
          token,
        }
      );

      setEstimate(data);
    } catch (err) {
      setEstimate(null);
      setError(err.message);
    } finally {
      setLoadingEstimate(false);
    }
  }

  async function requestRide(e) {
    e.preventDefault();

    if (!pickupZone || !destinationZone) {
      setError(
        'Select pickup and destination.'
      );
      return;
    }

    if (pickupZone === destinationZone) {
      setError(
        'Pickup and destination must be different.'
      );
      return;
    }

    setError('');
    setCreating(true);

    try {
      await api('/rides', {
        method: 'POST',
        token,
        body: {
          pickupZone,
          destinationZone,
          seats: Number(seats),
        },
      });

      setEstimate(null);

      /*
       * Do not wait for the 2-second polling cycle.
       * Immediately fetch the new ride.
       */
      await loadRides();

      setPickupZone('');
      setDestinationZone('');
      setSeats('1');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (!session) {
    return null;
  }

  return (
    <Shell
      user={session.user}
      onLogout={logout}
    >
      <div className="mx-auto max-w-5xl">

        {/* ================= HEADER ================= */}

        <div className="mb-6">
          <p className="text-sm text-slate-500">
            Passenger dashboard
          </p>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">
                Find your Tesla pool
              </h1>

              <p className="mt-1 text-slate-400">
                Welcome, {session.user.name}. Share a ride and split the fare.
              </p>
            </div>

            <button
              type="button"
              onClick={loadRides}
              disabled={loadingRides}
              className="btn"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  loadingRides
                    ? 'animate-spin'
                    : ''
                }`}
              />

              Refresh
            </button>
          </div>
        </div>

        <Alert
          message={error}
          onClose={() => setError('')}
        />

        {/* ================= CURRENT RIDE ================= */}

        {currentRide && (
          <RideStatus ride={currentRide} />
        )}

        {/* ================= REQUEST RIDE ================= */}

        {!currentRide && (
          <motion.div
            initial={{
              opacity: 0,
              y: 12,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="glass rounded-3xl p-6"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-400/10 p-3">
                <Car className="h-6 w-6 text-cyan-300" />
              </div>

              <div>
                <h2 className="text-xl font-bold">
                  Request a ride
                </h2>

                <p className="text-sm text-slate-500">
                  Choose where you are going.
                </p>
              </div>
            </div>

            <form onSubmit={requestRide}>
              <div className="grid gap-4 md:grid-cols-3">

                {/* Pickup */}

                <SelectField
                  label="Pickup"
                  value={pickupZone}
                  disabled={creating}
                  onChange={(e) => {
                    setPickupZone(e.target.value);
                    setEstimate(null);
                  }}
                >
                  <option value="">
                    Select pickup
                  </option>

                  {ZONES.map((zone) => (
                    <option
                      key={zone}
                      value={zone}
                    >
                      {labelize(zone)}
                    </option>
                  ))}
                </SelectField>

                {/* Destination */}

                <SelectField
                  label="Destination"
                  value={destinationZone}
                  disabled={creating}
                  onChange={(e) => {
                    setDestinationZone(
                      e.target.value
                    );
                    setEstimate(null);
                  }}
                >
                  <option value="">
                    Select destination
                  </option>

                  {ZONES.map((zone) => (
                    <option
                      key={zone}
                      value={zone}
                    >
                      {labelize(zone)}
                    </option>
                  ))}
                </SelectField>

                {/* Seats */}

                <SelectField
                  label="Seats"
                  value={seats}
                  disabled={creating}
                  onChange={(e) => {
                    setSeats(e.target.value);
                    setEstimate(null);
                  }}
                >
                  <option value="1">
                    1 seat
                  </option>

                  <option value="2">
                    2 seats
                  </option>

                  <option value="3">
                    3 seats
                  </option>
                </SelectField>

              </div>

              <div className="mt-5 flex flex-wrap gap-3">

                {/* Estimate */}

                <button
                  type="button"
                  onClick={getEstimate}
                  disabled={
                    loadingEstimate ||
                    creating ||
                    !pickupZone ||
                    !destinationZone
                  }
                  className="btn"
                >
                  {loadingEstimate ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    'Check fare'
                  )}
                </button>

                {/* Request */}

                <button
                  type="submit"
                  disabled={
                    creating ||
                    !pickupZone ||
                    !destinationZone
                  }
                  className="btn btn-primary"
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Requesting...
                    </>
                  ) : (
                    'Request Tesla'
                  )}
                </button>

              </div>
            </form>

            {/* ================= ESTIMATE ================= */}

            <AnimatePresence>
              {estimate && (
                <motion.div
                  initial={{
                    opacity: 0,
                    height: 0,
                  }}
                  animate={{
                    opacity: 1,
                    height: 'auto',
                  }}
                  exit={{
                    opacity: 0,
                    height: 0,
                  }}
                  className="overflow-hidden"
                >
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">

                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="text-xs text-slate-500">
                        Distance
                      </p>

                      <p className="mt-1 text-lg font-bold">
                        {estimate.distanceKm} km
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="text-xs text-slate-500">
                        Solo fare
                      </p>

                      <p className="mt-1 text-lg font-bold">
                        {taka(estimate.solo.total)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-emerald-400/5 p-4">
                      <p className="text-xs text-slate-500">
                        If pooled
                      </p>

                      <p className="mt-1 text-lg font-bold text-emerald-300">
                        {taka(estimate.ifPooled.total)}
                      </p>
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ================= RIDE HISTORY ================= */}

        <div className="mt-8">

          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">
                Ride history
              </h2>

              <p className="text-sm text-slate-500">
                Your previous Tesla pool requests.
              </p>
            </div>

            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">
              {rides.length} ride
              {rides.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loadingRides ? (
            <div className="glass rounded-3xl p-8 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />

              <p className="mt-3 text-sm text-slate-500">
                Loading rides...
              </p>
            </div>
          ) : rides.length === 0 ? (
            <div className="glass rounded-3xl p-8 text-center">
              <MapPin className="mx-auto h-8 w-8 text-slate-600" />

              <p className="mt-3 font-medium">
                No rides yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Request your first Tesla pool above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">

              {rides.map((ride) => (
                <motion.div
                  key={ride.id}
                  initial={{
                    opacity: 0,
                    y: 8,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  className="glass rounded-2xl p-5"
                >

                  <div className="flex flex-wrap items-start justify-between gap-4">

                    <div>
                      <div className="flex flex-wrap items-center gap-2">

                        <p className="font-semibold">
                          {ride.pickupZone}
                        </p>

                        <ArrowRight className="h-4 w-4 text-slate-600" />

                        <p className="font-semibold">
                          {ride.destinationZone}
                        </p>

                        <StatusBadge
                          status={ride.status}
                        />

                      </div>

                      <p className="mt-2 text-xs text-slate-500">
                        {ride.distanceKm} km · {ride.seats} seat
                        {ride.seats > 1 ? 's' : ''} ·{' '}
                        {timeOf(ride.createdAt)}
                      </p>
                    </div>

                    <div className="text-right">

                      <p className="font-bold text-emerald-300">
                        {taka(ride.farePaisa)}
                      </p>

                      {ride.poolDiscountPaisa > 0 && (
                        <p className="text-xs text-slate-500">
                          Saved{' '}
                          {taka(ride.poolDiscountPaisa)}
                        </p>
                      )}

                    </div>

                  </div>

                  {ride.tesla && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">
                      <Car className="h-4 w-4" />
                      {ride.tesla}
                    </div>
                  )}

                </motion.div>
              ))}

            </div>
          )}

        </div>
      </div>
    </Shell>
  );
}