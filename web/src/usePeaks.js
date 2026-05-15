import { useEffect, useRef, useState } from 'react';
import Peaks from 'peaks.js';

const ZOOM_LEVELS = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536];

export function usePeaks({ enabled, videoRef, zoomviewRef, overviewRef, waveformDataUrl }) {
  const [peaks, setPeaks] = useState(null);
  const [ready, setReady] = useState(false);
  const initStartedRef = useRef(false);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    if (initStartedRef.current) return;
    const video = videoRef.current;
    const zoomview = zoomviewRef.current;
    const overview = overviewRef.current;
    if (!video || !zoomview || !overview) return;

    initStartedRef.current = true;
    let cancelled = false;

    const options = {
      zoomview: {
        container: zoomview,
        waveformColor: '#4a8fdb',
        playedWaveformColor: '#7fb8ff',
        playheadColor: '#fff',
        axisGridlineColor: 'rgba(255,255,255,0.06)',
        axisLabelColor: '#888',
      },
      overview: {
        container: overview,
        waveformColor: '#3b6ea3',
        playedWaveformColor: '#5b8fc7',
        highlightColor: 'rgba(79,163,255,0.18)',
        highlightStrokeColor: '#4fa3ff',
        playheadColor: '#fff',
        showAxisLabels: false,
      },
      mediaElement: video,
      dataUri: { json: waveformDataUrl },
      zoomLevels: ZOOM_LEVELS,
      keyboard: false,
      logger: console.error.bind(console),
    };

    Peaks.init(options, (err, p) => {
      if (cancelled) {
        p?.destroy();
        return;
      }
      if (err) {
        console.error('peaks.js init failed:', err);
        initStartedRef.current = false;
        return;
      }
      instanceRef.current = p;
      setPeaks(p);
      setReady(true);
    });

    return () => {
      cancelled = true;
      // Only destroy on actual unmount; effect dep changes here would be a bug,
      // since initStartedRef guards re-init. Component unmount runs this and frees peaks.
      instanceRef.current?.destroy();
      instanceRef.current = null;
      initStartedRef.current = false;
    };
  }, [enabled, videoRef, zoomviewRef, overviewRef, waveformDataUrl]);

  return { peaks, ready };
}
