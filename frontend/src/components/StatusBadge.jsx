const MAP = {
  REQUESTED: ['Waiting', 'bg-amber-400/15 text-amber-300'],
  MATCHED: ['Matched', 'bg-sky-400/15 text-sky-300'],
  DRIVER_ARRIVED: ['Driver arrived', 'bg-violet-400/15 text-violet-300'],
  STARTED: ['In progress', 'bg-emerald-400/15 text-emerald-300'],
  COMPLETED: ['Completed', 'bg-slate-400/15 text-slate-300'],
  CANCELLED: ['Cancelled', 'bg-red-400/15 text-red-300'],
  OPEN: ['Open for riders', 'bg-sky-400/15 text-sky-300'],
};

export default function StatusBadge({ status }) {
  const [label, classes] = MAP[status] || [status, 'bg-white/10 text-slate-300'];
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${classes}`}>{label}</span>;
}
