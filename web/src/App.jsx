import { useEffect, useRef, useState } from 'react';
import { usePeaks } from './usePeaks.js';
import { Topbar } from './Topbar.jsx';
import { Bottombar } from './Bottombar.jsx';
import { Sidebar } from './Sidebar.jsx';
import { formatTime } from './time.js';

export default function App() {
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const zoomviewRef = useRef(null);
  const overviewRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    fetch('/api/project')
      .then((r) => r.json())
      .then(setProject)
      .catch((e) => setError(e.message));
  }, []);

  const masterUrl = project ? `/master/${encodeURIComponent(project.project.masterFile)}` : null;

  const { peaks, ready } = usePeaks({
    enabled: Boolean(project),
    videoRef,
    zoomviewRef,
    overviewRef,
    waveformDataUrl: '/postprod/waveform.json',
  });

  useEffect(() => {
    if (!peaks) return;
    const onTimeUpdate = () => {
      const v = videoRef.current;
      if (v) setCurrentTime(v.currentTime);
    };
    const v = videoRef.current;
    v?.addEventListener('timeupdate', onTimeUpdate);
    v?.addEventListener('loadedmetadata', () => setDuration(v.duration));
    return () => {
      v?.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [peaks]);

  useEffect(() => {
    if (!peaks) return;
    const onKey = (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && t.matches('input, textarea')) return;
      const v = videoRef.current;
      if (!v) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (v.paused) v.play();
        else v.pause();
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        peaks.zoom.zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        peaks.zoom.zoomOut();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        v.currentTime = Math.max(0, v.currentTime - (e.shiftKey ? 0.1 : 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        v.currentTime = Math.min(v.duration || Infinity, v.currentTime + (e.shiftKey ? 0.1 : 1));
      } else if (e.key === '0') {
        peaks.player.seek(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [peaks]);

  if (error) return <div className="error">Error: {error}</div>;
  if (!project) return <div className="loading">Loading project…</div>;

  return (
    <div className="app">
      <Topbar
        project={project}
        peaks={peaks}
        videoRef={videoRef}
      />
      <div className="main">
        <div className="center">
          <div className="video-wrap">
            {masterUrl && (
              <video ref={videoRef} src={masterUrl} controls={false} preload="metadata" />
            )}
          </div>
          <div className="transport">
            <button
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                if (v.paused) v.play();
                else v.pause();
              }}
              disabled={!ready}
            >
              Play / Pause
            </button>
            <div className="time">
              <span className="now">{formatTime(currentTime)}</span>
              {' / '}
              <span>{formatTime(duration)}</span>
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={() => peaks?.zoom.zoomOut()} disabled={!ready}>−</button>
            <button onClick={() => peaks?.zoom.zoomIn()} disabled={!ready}>+</button>
          </div>
          <div ref={zoomviewRef} className="zoomview" />
          <div ref={overviewRef} className="overview" />
        </div>
        <Sidebar project={project} />
      </div>
      <Bottombar />
    </div>
  );
}
