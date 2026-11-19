import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export function useRideQuery<T>(key: string | undefined, load: () => Promise<T>) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ key: string; version: number; data?: T; error?: string }>();
  useFocusEffect(useCallback(() => {
    if (!key) return;
    let active = true;
    void load().then((data) => {
      if (active) setResult({ key, version, data });
    }).catch((cause: unknown) => {
      if (active) setResult({ key, version, error: cause instanceof Error ? cause.message : '정보를 불러오지 못했어요.' });
    });
    return () => { active = false; };
  }, [key, load, version]));

  const current = key && result?.key === key && result.version === version ? result : undefined;
  return { data: current?.data, error: current?.error, reload: () => setVersion((value) => value + 1) };
}
