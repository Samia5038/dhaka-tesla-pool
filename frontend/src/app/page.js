'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import Shell from '@/components/Shell';
import Alert from '@/components/Alert';
import { api } from '@/lib/api';
import { loadSession, saveSession } from '@/lib/session';

const DEMO = [
  { name: 'Nusrat', role: 'Passenger', email: 'nusrat@teslapool.test' },
  { name: 'Rafiq', role: 'Passenger', email: 'rafiq@teslapool.test' },
  { name: 'Shirin', role: 'Passenger', email: 'shirin@teslapool.test' },
  { name: 'Jashim', role: 'Driver (Bullet)', email: 'jashim@teslapool.test' },
];

function homeFor(user) {
  return user.role === 'DRIVER' ? '/driver' : '/passenger';
}

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (s) router.replace(homeFor(s.user));
  }, [router]);

  async function authenticate(path, body) {
    setError('');
    setLoading(true);
    try {
      const data = await api(`/auth/${path}`, { method: 'POST', body });
      saveSession(data);
      router.replace(homeFor(data.user));
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (mode === 'signup') authenticate('signup', form);
    else authenticate('login', { email: form.email, password: form.password });
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <Shell>
      <div className="mx-auto mt-6 grid max-w-4xl items-center gap-10 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1, duration: 0.6 }}>
          <h1 className="text-5xl font-bold leading-tight">
            Share a seat.
            <br />
            <span className="text-gradient">Split the fare.</span>
          </h1>
          <p className="mt-4 text-slate-400">Pool a Tesla across Dhaka. Pay less, ride together, skip the awkward small talk.</p>

          <p className="mb-3 mt-8 text-xs uppercase tracking-wide text-slate-500">Quick demo login (password: password123)</p>
          <div className="grid grid-cols-2 gap-3">
            {DEMO.map((d) => (
              <motion.button
                key={d.email}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.96 }}
                disabled={loading}
                onClick={() => authenticate('login', { email: d.email, password: 'password123' })}
                className="glass rounded-2xl px-4 py-3 text-left disabled:opacity-50"
              >
                <p className="font-semibold">{d.name}</p>
                <p className="text-xs text-slate-400">{d.role}</p>
              </motion.button>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.6 }} className="glass rounded-3xl p-6">
          <div className="mb-5 flex rounded-full bg-white/5 p-1">
            {['login', 'signup'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(''); }}
                className="relative flex-1 rounded-full py-2 text-sm font-semibold"
              >
                {mode === m && (
                  <motion.span layoutId="tab" className="absolute inset-0 rounded-full bg-white/10" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
                <span className="relative">{m === 'login' ? 'Sign in' : 'Sign up'}</span>
              </button>
            ))}
          </div>

          <Alert message={error} onClose={() => setError('')} />

          <form onSubmit={submit} className="space-y-3">
            <AnimatePresence initial={false}>
              {mode === 'signup' && (
                <motion.div key="name" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <input className="input" placeholder="Your name" value={form.name} onChange={set('name')} required />
                </motion.div>
              )}
            </AnimatePresence>
            <input className="input" type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
            <input className="input" type="password" placeholder="Password (min 6 characters)" value={form.password} onChange={set('password')} required />
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create passenger account'}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">Sign up creates a passenger account. Drivers are added by the admin.</p>
        </motion.div>
      </div>
    </Shell>
  );
}
