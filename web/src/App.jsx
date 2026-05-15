import { useEffect, useMemo, useRef, useState } from 'react';
import { usePeaks } from './usePeaks.js';
import { usePeaksSegments } from './usePeaksSegments.js';
import { useProject } from './useProject.js';
import { Topbar } from './Topbar.jsx';
import { Bottombar } from './Bottombar.jsx';
import { PiecesPanel } from './PiecesPanel.jsx';
import { EncodePanel } from './EncodePanel.jsx';
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
  const videoRef = useRef(null);
  const zoomviewRef = useRef(null);
  const overviewRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

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

  usePeaksSegments({ peaks, project, selectedId, onSegmentChange });

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTimeUpdate = () => setCurrentTime(v.currentTime);
    const onLoaded = () => setDuration(v.duration);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('loadedmetadata', onLoaded);
    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [masterUrl]);

  const addPiece = () => {
    const span = defaultSegmentSpan(currentTime, duration, 30);
    update((prev) => {
      const pieces = [...(prev.pieces || []), newPiece(span)];
      const renumbered = renumber(pieces);
      const added = renumbered.find((p) => p.startTime === span.startTime && p.endTime === span.endTime);
      if (added) queueMicrotask(() => setSelectedId(`piece-${added.number}`));
      return { ...prev, pieces: renumbered };
    });
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

  const updateTitle = (id, title) => {
    update((prev) => {
      const pm = id.match(/^piece-(\d+)$/);
      const mm = id.match(/^mov-(\d+)-([a-z])$/);
      const pieces = prev.pieces.map((p) => {
        if (pm && p.number === parseInt(pm[1], 10)) return { ...p, title };
        if (mm && p.number === parseInt(mm[1], 10)) {
          return {
            ...p,
            movements: p.movements.map((m) => (m.letter === mm[2] ? { ...m, title } : m)),
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
  }, [peaks, project, selectedId, currentTime, duration]);

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
              <span className="sep"> / </span>
              <span className="dur">{formatTime(duration)}</span>
            </div>
            <div className="spacer" />
            <button onClick={addPiece} disabled={!ready}>+ Piece</button>
            <button onClick={addMovement} disabled={!ready}>+ Movement</button>
            <span className="divider" />
            <button onClick={() => peaks?.zoom.zoomOut()} disabled={!ready}>−</button>
            <button onClick={() => peaks?.zoom.zoomIn()} disabled={!ready}>+</button>
          </div>
          <div ref={zoomviewRef} className="zoomview" />
          <div ref={overviewRef} className="overview" />
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
          <EncodePanel disabled={!project || (project.pieces || []).length === 0} />
        </div>
      </div>
      <Bottombar />
    </div>
  );
}
