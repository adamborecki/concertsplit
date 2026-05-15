import { useEffect, useState } from 'react';

export function useSilence() {
  const [regions, setRegions] = useState([]);

  useEffect(() => {
    fetch('/postprod/silence-regions.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRegions(Array.isArray(data) ? data : []))
      .catch(() => setRegions([]));
  }, []);

  return regions;
}
