'use client';

import { AnimatePresence, motion } from 'framer-motion';

export default function Alert({ message, onClose }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key="alert"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          <span>{message}</span>
          {onClose && (
            <button onClick={onClose} className="text-red-300 hover:text-white">
              Dismiss
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
