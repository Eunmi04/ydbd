import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useApp } from '../state/AppContext';
import { serviceErrorMessage } from '../services/profileService';

// Two devices need to observe each other's preparation, boarding and settlement.
export function useServiceSync() {
  const { mode, user, refreshRooms, refreshSettlements, refreshCredits } = useApp();
  const userId = user?.id;
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    if (mode !== 'supabase' || !userId) return;
    let active = true;
    let running = false;
    const sync = async () => {
      if (running) return;
      running = true;
      try {
        await refreshRooms();
        await Promise.all([refreshSettlements(), refreshCredits()]);
        if (active) setError('');
      } catch (cause) { if (active) setError(serviceErrorMessage(cause)); }
      finally { running = false; }
    };
    void sync();
    const timer = setInterval(() => void sync(), 3000);
    return () => { active = false; clearInterval(timer); };
  }, [mode, userId, refreshRooms, refreshSettlements, refreshCredits]));
  return error;
}
