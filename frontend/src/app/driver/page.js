'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Zap } from 'lucide-react';

import Shell from '@/components/Shell';
import Alert from '@/components/Alert';
import SeatMeter from '@/components/SeatMeter';
import StatusBadge from '@/components/StatusBadge';

import { api } from '@/lib/api';
import { taka, timeOf } from '@/lib/format';
import { useSession } from '@/lib/useSession';
import { usePolling } from '@/lib/usePolling';

// pool status -> [api action, button label]
const NEXT = {
  OPEN: ['arrive', 'Mark arrived'],
  DRIVER_ARRIVED: ['start', 'Start trip'],
  STARTED: ['complete', 'Complete trip'],
};

function Toggle({ on, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-pressed={on}
      aria-label={on ? 'Turn Tesla offline' : 'Turn Tesla online'}
      className="relative h-8 w-16 rounded-full border border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: on
          ? 'linear-gradient(135deg,#10b981,#06b6d4)'
          : 'rgba(255,255,255,0.08)',
      }}
    >
      <motion.span
        layout
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30,
        }}
        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow"
        style={{
          left: on ? '2.2rem' : '0.25rem',
        }}
      />
    </button>
  );
}

export default function DriverPage() {
  const { session, logout } = useSession('DRIVER');

  const token = session?.token;

  const [current, setCurrent] = useState(null);
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const tesla = current?.tesla;
  const pool = current?.pool;

  const load = useCallback(async () => {
    if (!token) return;

    try {
      const [poolData, requestData, historyData] =
        await Promise.all([
          api('/driver/pool/current', { token }),
          api('/driver/requests', { token }),
          api('/driver/history', { token }),
        ]);

      setCurrent(poolData);
      setRequests(requestData.requests || []);
      setHistory(historyData.pools || []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  // Live updates every 3 seconds.
  usePolling(load, 3000, !!token);

  async function act(key, fn) {
    setBusy(key);
    setError('');

    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function toggleOnline() {
    if (!tesla || !token || busy === 'online') return;

    const nextOnline = !tesla.isOnline;

    // Optimistic UI:
    // toggle immediately without waiting for the API.
    setCurrent((prev) => {
      if (!prev?.tesla) return prev;

      return {
        ...prev,
        tesla: {
          ...prev.tesla,
          isOnline: nextOnline,
        },
      };
    });

    setBusy('online');
    setError('');

    try {
      await api('/driver/online', {
        method: 'PUT',
        token,
        body: {
          isOnline: nextOnline,
        },
      });

      // Confirm actual backend state after success.
      await load();
    } catch (err) {
      // If API fails, reload backend state.
      await load();
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function advancePool() {
    if (!pool || !token) return;

    const next = NEXT[pool.status];

    if (!next) return;

    const [action] = next;

    await act(`pool-${action}`, () =>
      api(`/driver/pools/${pool.id}/${action}`, {
        method: 'POST',
        token,
      })
    );
  }

  if (!session) {
    return (
      <Shell>
        <div className="mx-auto max-w-4xl py-16 text-center">
          <p className="text-slate-400">
            Checking driver session...
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell user={session.user} onLogout={logout}>
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">
              Driver console
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Tesla Pool Control
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Manage your Tesla, accept riders, and advance the current trip.
            </p>
          </div>

          {tesla && (
            <div className="glass flex items-center gap-4 rounded-2xl px-4 py-3">
              <div>
                <p className="font-semibold">
                  {tesla.name}
                </p>

                <p className="text-xs text-slate-400">
                  {tesla.capacity} seats
                </p>
              </div>

              <Toggle
                on={tesla.isOnline}
                onChange={toggleOnline}
                disabled={busy === 'online'}
              />

              <span
                className={`text-xs font-semibold ${
                  tesla.isOnline
                    ? 'text-emerald-300'
                    : 'text-slate-500'
                }`}
              >
                {busy === 'online'
                  ? 'UPDATING...'
                  : tesla.isOnline
                    ? 'ONLINE'
                    : 'OFFLINE'}
              </span>
            </div>
          )}
        </div>

        <Alert
          message={error}
          onClose={() => setError('')}
        />

        {/* Current pool */}
        {pool ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-3xl p-6"
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold">
                    Current pool
                  </h2>

                  <StatusBadge status={pool.status} />
                </div>

                <div className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                  <span>{pool.pickupZone}</span>
                  <ArrowRight size={16} />
                  <span>Shared Tesla trip</span>
                </div>
              </div>

              <div className="flex flex-col items-start gap-2 md:items-end">
                <SeatMeter
                  occupied={pool.seatsOccupied}
                  total={pool.seatsTotal}
                />

                {NEXT[pool.status] && (
                  <button
                    className="btn btn-primary"
                    disabled={busy.startsWith('pool-')}
                    onClick={advancePool}
                  >
                    {busy.startsWith('pool-')
                      ? 'Updating...'
                      : NEXT[pool.status][1]}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {pool.passengers.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No passengers in this pool.
                </p>
              ) : (
                pool.passengers.map((p) => (
                  <div
                    key={p.rideId}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">
                          {p.name}
                        </p>

                        <p className="text-sm text-slate-400">
                          {p.destinationZone}
                        </p>

                        <p className="text-xs text-slate-500">
                          {p.seats} seat
                          {p.seats > 1 ? 's' : ''}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="font-semibold text-emerald-300">
                          {taka(p.farePaisa)}
                        </p>

                        <StatusBadge status={p.status} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        ) : (
          <div className="glass rounded-3xl p-8 text-center">
            <Zap
              className="mx-auto mb-3 text-cyan-400"
              size={28}
            />

            <h2 className="text-lg font-semibold">
              No active pool
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Accept a passenger request to create a pool.
            </p>
          </div>
        )}

        {/* Waiting requests */}
        <div className="glass rounded-3xl p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">
                Passenger requests
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Waiting requests that can fit your Tesla.
              </p>
            </div>

            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">
              {requests.length} waiting
            </span>
          </div>

          {requests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
              <p className="text-sm text-slate-500">
                No passenger requests right now.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {requests.map((r) => (
                  <motion.div
                    key={r.id}
                    initial={{
                      opacity: 0,
                      y: 8,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    exit={{
                      opacity: 0,
                      y: -8,
                    }}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">
                          {r.passengerName}
                        </p>

                        <p className="mt-1 flex items-center gap-2 text-sm text-slate-300">
                          {r.pickupZone}
                          <ArrowRight size={13} />
                          {r.destinationZone}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {r.seats} seat
                          {r.seats > 1 ? 's' : ''},{' '}
                          {timeOf(r.createdAt)}
                        </p>
                      </div>

                      <button
                        className="btn btn-primary"
                        style={{
                          padding: '0.45rem 1rem',
                        }}
                        disabled={
                          !tesla?.isOnline ||
                          busy === `accept-${r.id}`
                        }
                        onClick={() =>
                          act(
                            `accept-${r.id}`,
                            () =>
                              api(
                                `/driver/requests/${r.id}/accept`,
                                {
                                  method: 'POST',
                                  token,
                                }
                              )
                          )
                        }
                      >
                        {busy === `accept-${r.id}`
                          ? '...'
                          : 'Accept'}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* History */}
        {history.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm uppercase tracking-wide text-slate-500">
              Completed trips
            </h3>

            <div className="space-y-2">
              {history.map((h) => (
                <div
                  key={h.poolId}
                  className="glass rounded-2xl px-4 py-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium">
                      {h.pickupZone},{' '}
                      {h.passengers.length} rider
                      {h.passengers.length > 1 ? 's' : ''}
                    </p>

                    <p className="font-semibold text-emerald-300">
                      {taka(
                        h.passengers.reduce(
                          (sum, p) => sum + p.farePaisa,
                          0
                        )
                      )}
                    </p>
                  </div>

                  <p className="text-xs text-slate-500">
                    {h.passengers
                      .map((p) => p.name)
                      .join(', ')}{' '}
                    at {timeOf(h.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}