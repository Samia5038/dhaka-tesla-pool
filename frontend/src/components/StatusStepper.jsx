'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const STEPS = [
  { key: 'REQUESTED', label: 'Waiting' },
  { key: 'MATCHED', label: 'Matched' },
  { key: 'DRIVER_ARRIVED', label: 'Driver here' },
  { key: 'STARTED', label: 'On the way' },
  { key: 'COMPLETED', label: 'Done' },
];

export default function StatusStepper({ status }) {
  if (status === 'CANCELLED') return null;

  const finished = status === 'COMPLETED';
  const index = Math.max(0, STEPS.findIndex((s) => s.key === status));
  const pct = (index / (STEPS.length - 1)) * 100;

  return (
    <div className="relative mb-8 mt-5">
      <div className="absolute left-3 right-3 top-3 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg,#10b981,#06b6d4)' }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 70, damping: 16 }}
        />
      </div>

      <div className="relative flex justify-between">
        {STEPS.map((step, i) => {
          const done = finished || i < index;
          const current = !finished && i === index;
          return (
            <div key={step.key} className="flex w-6 flex-col items-center">
              <motion.div
                initial={false}
                animate={{
                  scale: current ? 1.15 : 1,
                  boxShadow: current ? '0 0 0 6px rgba(16,185,129,0.25)' : '0 0 0 0px rgba(16,185,129,0)',
                }}
                className={`grid h-6 w-6 place-items-center rounded-full border text-xs ${
                  done || current
                    ? 'border-emerald-300 bg-emerald-400 text-slate-900'
                    : 'border-white/20 bg-slate-900 text-slate-500'
                }`}
              >
                {done ? <Check size={14} /> : i + 1}
              </motion.div>
              <span className={`mt-2 whitespace-nowrap text-[11px] ${current ? 'text-emerald-300' : 'text-slate-500'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
