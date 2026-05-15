import { useCallback, useEffect, useRef, useState } from 'react';

const SAVE_DEBOUNCE_MS = 400;

export function useProject() {
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  const [savingState, setSavingState] = useState('idle');
  const pendingRef = useRef(null);
  const timerRef = useRef(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    fetch('/api/project')
      .then((r) => r.json())
      .then(setProject)
      .catch((e) => setError(e.message));
  }, []);

  const flush = useCallback(async () => {
    if (!pendingRef.current || inFlightRef.current) return;
    const body = pendingRef.current;
    pendingRef.current = null;
    inFlightRef.current = true;
    setSavingState('saving');
    try {
      const res = await fetch('/api/project', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      setSavingState('saved');
    } catch (e) {
      setSavingState('error');
      console.error(e);
    } finally {
      inFlightRef.current = false;
      if (pendingRef.current) flush();
    }
  }, []);

  const update = useCallback(
    (mutator) => {
      setProject((prev) => {
        if (!prev) return prev;
        const next = mutator(prev);
        pendingRef.current = next;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
        return next;
      });
    },
    [flush],
  );

  return { project, error, update, savingState };
}
