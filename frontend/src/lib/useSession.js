'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, loadSession } from './session';

// Guards a page: no session or wrong role sends the user back to the login screen.
export function useSession(role) {
  const router = useRouter();
  const [session, setSession] = useState(null);

  useEffect(() => {
    const s = loadSession();
    if (!s || s.user.role !== role) {
      router.replace('/');
      return;
    }
    setSession(s);
  }, [role, router]);

  const logout = useCallback(() => {
    clearSession();
    router.replace('/');
  }, [router]);

  return { session, logout };
}
