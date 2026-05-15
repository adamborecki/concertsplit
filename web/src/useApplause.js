import { useEffect, useState } from 'react';

export function useApplause() {
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    fetch('/postprod/applause-candidates.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCandidates(Array.isArray(data) ? data : []))
      .catch(() => setCandidates([]));
  }, []);

  return candidates;
}
