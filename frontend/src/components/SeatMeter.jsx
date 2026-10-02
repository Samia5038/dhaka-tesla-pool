'use client';

import { motion } from 'framer-motion';
import { Armchair, User } from 'lucide-react';

// Shows each seat of the Tesla. Occupied seats fill with a little spring animation.
export default function SeatMeter({ occupied, total }) {
  return (
    <div className="flex items-center gap-3">
      {Array.from({ length: total }).map((_, i) => {
        const filled = i < occupied;
        return (
          <motion.div
            key={i}
            initial={false}
            animate={{ scale: filled ? 1 : 0.92, opacity: filled ? 1 : 0.55 }}
            transition={{ type: 'spring', stiffness: 300, damping: 16 }}
            className={`grid h-14 w-14 place-items-center rounded-2xl border ${
              filled ? 'border-emerald-300/60 bg-emerald-400/20 text-emerald-200' : 'border-white/15 bg-white/5 text-slate-500'
            }`}
          >
            {filled ? <User size={24} /> : <Armchair size={24} />}
          </motion.div>
        );
      })}
      <p className="ml-2 text-sm text-slate-300">
        <span className="text-xl font-bold text-white">{occupied}</span> / {total} seats
      </p>
    </div>
  );
}
