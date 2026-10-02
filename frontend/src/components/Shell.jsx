'use client';

import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

export default function Shell({ user, onLogout, children }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="blob" style={{ width: 420, height: 420, background: '#10b981', top: -120, left: -100 }} />
      <div className="blob" style={{ width: 380, height: 380, background: '#06b6d4', bottom: -120, right: -80, animationDelay: '-6s' }} />

      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background: 'linear-gradient(135deg,#10b981,#06b6d4)' }}>
            <Zap size={20} color="#04110d" />
          </div>
          <div>
            <p className="font-semibold leading-tight">Dhaka Tesla Pool</p>
            <p className="text-xs text-slate-400">Share a seat. Split the fare.</p>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300">{user.name}</span>
            <button onClick={onLogout} className="btn btn-ghost" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
              Log out
            </button>
          </div>
        )}
      </header>

      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 mx-auto max-w-5xl px-5 pb-16"
      >
        {children}
      </motion.main>
    </div>
  );
}
