import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { usePeaks } from './usePeaks.js';
import { usePeaksSegments } from './usePeaksSegments.js';
import { useWaveformGestures } from './useWaveformGestures.js';
import { useProject } from './useProject.js';
import { useApplause } from './useApplause.js';
import { Topbar } from './Topbar.jsx';
import { Bottombar } from './Bottombar.jsx';
import { PiecesPanel } from './PiecesPanel.jsx';
import { EncodePanel } from './EncodePanel.jsx';
import { SegmentInspector } from './SegmentInspector.jsx';
import { formatTime } from './time.js';
import {
  defaultSegmentSpan,
  findPieceContaining,
  newMovement,
  newPiece,
  renumber,
} from './pieces.js';

export default function App() {
  const { project, error, update, savingState } = useProject();
  const applause = useApplause();
  const videoRef = useRef(null);
  const zoomviewRef = useRef(null);
  const overviewRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [settingEndFor, setSettingEndFor] = useState(null); // segment id currently in "set end" mode

  const masterUrl = project ? `/master/${encodeURIComponent(project.project.masterFile)}` : null;

  const { peaks, ready } = usePeaks({
    enabled: Boolean(project),
    videoRef,
    zoomviewRef,
    overviewRef,
    waveformDataUrl: '/postprod/waveform.json',
  });

  const selectedPieceNumber = useMemo(() => {
    if (!selectedId || !project) return null;
    const m = selectedId.match(/^piece-(\d+)$/) || selectedId.match(/^mov-(\d+)-/);
    return m ? parseInt(m[1], 10) : null;
  }, [selectedId, project]);

  const onSegmentChange = (id, start, end) => {
    update((prev) => {
      const pieces = prev.pieces.map((p) => {
        if (id === `piece-${p.number}`) return { ...p, startTime: start, endTime: end };
        const movements = p.movements.map((m) =>
          id === `mov-${p.number}-${m.letter}` ? { ...m, startTime: start, endTime: end } : m
        );
        return { ...p, movements };
      });
      return { ...prev, pieces: renumber(pieces) };
    });
  };

  usePeaksSegments({ peaks, project, selectedId, applause, onSegmentChange });
  useWaveformGestures({ containerRef: zoomviewRef, peaks, videoRef });

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTimeUpdate = () => setCurrentTime(v.currentTime);
    const onLoaded = () => setDuration(v.duration);
    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [masterUrl]);

  const addPiece = () => {
    const span = defaultSegmentSpan(currentTime, duration, 30);
    update((prev) => {
      const pieces = [...(prev.pieces || []), newPiece(span)];
      const renumbered = renumber(pieces);
      const added = renumbered.find((p) => p.startTime === span.startTime && p.endTime === span.endTime);
      if (added) {
        const id = `piece-${added.number}`;
        queueMicrotask(() => { setSelectedId(id); setSettingEndFor(id); });
      }
      return { ...prev, pieces: renumbered };
    });
  };

  const confirmEnd = () => {
    if (!settingEndFor) return;
    const t = Math.max(currentTime, 0);
    onSegmentChange(settingEndFor, (() => {
      const pm = settingEndFor.match(/^piece-(\d+)$/);
      const p = project?.pieces.find((p) => p.number === parseInt(pm[1], 10));
      return p ? p.startTime : 0;
    })(), t);
    setSettingEndFor(null);
  };

  const addMovement = () => {
    if (!project) return;
    const piece = selectedPieceNumber
      ? project.pieces.find((p) => p.number === selectedPieceNumber)
      : findPieceContaining(project.pieces || [], currentTime);
    if (!piece) {
      alert('Place the playhead inside a piece (or select one) to add a movement.');
      return;
    }
    const span = defaultSegmentSpan(
      Math.max(currentTime, piece.startTime),
      Math.min(piece.endTime, (duration || piece.endTime)),
      15,
    );
    span.endTime = Math.min(span.endTime, piece.endTime);
    update((prev) => {
      const pieces = prev.pieces.map((p) => {
        if (p.number !== piece.number) return p;
        return { ...p, movements: [...(p.movements || []), newMovement(span)] };
      });
      const renumbered = renumber(pieces);
      const targetPiece = renumbered.find((p) => p.number === piece.number);
      const added = targetPiece?.movements.find((m) => m.startTime === span.startTime && m.endTime === span.endTime);
      if (added) queueMicrotask(() => setSelectedId(`mov-${targetPiece.number}-${added.letter}`));
      return { ...prev, pieces: renumbered };
    });
  };

  const removeSegment = (id) => {
    update((prev) => {
      let pieces;
      const pm = id.match(/^piece-(\d+)$/);
      const mm = id.match(/^mov-(\d+)-([a-z])$/);
      if (pm) {
        const n = parseInt(pm[1], 10);
        pieces = prev.pieces.filter((p) => p.number !== n);
      } else if (mm) {
        const n = parseInt(mm[1], 10);
        const letter = mm[2];
        pieces = prev.pieces.map((p) =>
          p.number !== n ? p : { ...p, movements: p.movements.filter((m) => m.letter !== letter) }
        );
      } else {
        return prev;
      }
      setSelectedId(null);
      return { ...prev, pieces: renumber(pieces) };
    });
  };

  const updateTitle = (id, title) => updateSegment(id, (s) => ({ ...s, title }));

  const updateSegment = (id, mutator) => {
    update((prev) => {
      const pm = id.match(/^piece-(\d+)$/);
      const mm = id.match(/^mov-(\d+)-([a-z])$/);
      const pieces = prev.pieces.map((p) => {
        if (pm && p.number === parseInt(pm[1], 10)) return mutator(p);
        if (mm && p.number === parseInt(mm[1], 10)) {
          return {
            ...p,
            movements: p.movements.map((m) => (m.letter === mm[2] ? mutator(m) : m)),
          };
        }
        return p;
      });
      return { ...prev, pieces };
    });
  };

  const seek = (t) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, Math.min(v.duration || t, t));
  };

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
        seek(v.currentTime - (e.shiftKey ? 0.1 : 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seek(v.currentTime + (e.shiftKey ? 0.1 : 1));
      } else if (e.key === '0') {
        seek(0);
      } else if (e.key === 'e' || e.key === 'E') {
        if (settingEndFor) { e.preventDefault(); confirmEnd(); }
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        addPiece();
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        addMovement();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          e.preventDefault();
          removeSegment(selectedId);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [peaks, project, selectedId, currentTime, duration, settingEndFor]);

  if (error) return <div className="error">Error: {error}</div>;
  if (!project) return <div className="loading">Loading project…</div>;

  return (
    <div className="app">
      <Topbar project={project} savingState={savingState} />
      <div className="main">
        <div className="center">
          <div className="video-wrap">
            {masterUrl && (
              <video ref={videoRef} src={masterUrl} controls={false} preload="metadata" />
            )}
          </div>
          <div className="transport">
            <button
              className="play-btn"
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                if (v.paused) v.play();
                else v.pause();
              }}
              disabled={!ready}
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
            <div className="time">
              <span className="now">{formatTime(currentTime)}</span>
              <span className="sep"> / </span>
              <span className="dur">{formatTime(duration)}</span>
            </div>
            <div className="spacer" />
            {settingEndFor ? (
              <button className="set-end-btn" onClick={confirmEnd}>Set End (E)</button>
            ) : (
              <button onClick={addPiece} disabled={!ready}>+ Piece</button>
            )}
            <button onClick={addMovement} disabled={!ready || !!settingEndFor}>+ Movement</button>
            <span className="divider" />
            <button onClick={() => peaks?.zoom.zoomOut()} disabled={!ready}>−</button>
            <button onClick={() => peaks?.zoom.zoomIn()} disabled={!ready}>+</button>
          </div>
          <div ref={zoomviewRef} className="zoomview" />
          <div className="overview-wrap">
            <div ref={overviewRef} className="overview" />
            <OverviewMarkers project={project} duration={duration} />
          </div>
        </div>
        <div className="right">
          <PiecesPanel
            project={project}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={removeSegment}
            onSeek={seek}
            onUpdateTitle={updateTitle}
          />
          <SegmentInspector
            project={project}
            selectedId={selectedId}
            applause={applause}
            currentTime={currentTime}
            onUpdateSegment={updateSegment}
          />
          <EncodePanel disabled={!project || (project.pieces || []).length === 0} />
        </div>
      </div>
      <Bottombar />
    </div>
  );
}

function OverviewMarkers({ project, duration }) {
  if (!duration || !project?.pieces?.length) return null;
  const marks = [];
  for (const piece of project.pieces) {
    marks.push({ t: piece.startTime, kind: 'piece' });
    marks.push({ t: piece.endTime, kind: 'piece' });
    for (const mov of piece.movements || []) {
      marks.push({ t: mov.startTime, kind: 'mov' });
      marks.push({ t: mov.endTime, kind: 'mov' });
    }
  }
  // Deduplicate
  const seen = new Set();
  const unique = marks.filter(({ t }) => {
    const k = Math.round(t * 10);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return (
    <svg className="overview-markers" aria-hidden="true">
      {unique.map(({ t, kind }, i) => {
        const pct = (t / duration) * 100;
        return (
          <line
            key={i}
            x1={`${pct}%`} x2={`${pct}%`}
            y1="0" y2="100%"
            className={`overview-marker overview-marker--${kind}`}
          />
        );
      })}
    </svg>
  );
}
