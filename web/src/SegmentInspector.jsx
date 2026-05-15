import { useMemo } from 'react';
import { movementLabel, pieceLabel } from './pieces.js';
import { formatTime } from './time.js';

const DEFAULT_APPLAUSE_GAIN_DB = -12;

export function SegmentInspector({ project, selectedId, applause, currentTime, onUpdateSegment }) {
  const found = useMemo(() => findSelected(project, selectedId), [project, selectedId]);
  if (!found) {
    return (
      <div className="inspector inspector--empty">
        <h2>Inspector</h2>
        <div className="placeholder">Select a piece or movement to edit its properties.</div>
      </div>
    );
  }
  const { piece, movement, kind, label } = found;
  const seg = movement ?? piece;
  const duration = seg.endTime - seg.startTime;
  const audioOut = seg.fades?.audioOut ?? 0;
  const videoOut = seg.fades?.videoOut ?? 0;
  const zoom = seg.zoom ?? { level: 1, x: 0, y: 0 };
  const automation = seg.automation ?? [];

  const setFade = (key, value) => {
    onUpdateSegment(selectedId, (s) => ({
      ...s,
      fades: { ...(s.fades || {}), [key]: clamp(value, 0, duration) },
    }));
  };
  const setZoom = (key, value) => {
    onUpdateSegment(selectedId, (s) => ({
      ...s,
      zoom: { ...(s.zoom || { level: 1, x: 0, y: 0 }), [key]: value },
    }));
  };
  const updateAutomationAt = (i, mutator) => {
    onUpdateSegment(selectedId, (s) => ({
      ...s,
      automation: (s.automation || []).map((a, idx) => (idx === i ? mutator(a) : a)),
    }));
  };
  const removeAutomationAt = (i) => {
    onUpdateSegment(selectedId, (s) => ({
      ...s,
      automation: (s.automation || []).filter((_, idx) => idx !== i),
    }));
  };
  const addAutomationRegion = ({ startTime, endTime, gainDb }) => {
    onUpdateSegment(selectedId, (s) => ({
      ...s,
      automation: [...(s.automation || []), { startTime, endTime, gainDb }],
    }));
  };

  const applauseInSegment = (applause || []).filter(
    (a) => a.endTime > seg.startTime && a.startTime < seg.endTime,
  );

  return (
    <div className="inspector">
      <div className="inspector-header">
        <h2>Inspector</h2>
        <div className="inspector-target">
          <span className="badge">{label}</span>
          <span className="muted">{kind}</span>
        </div>
      </div>

      <div className="prop-grid">
        <Prop label="Start">{formatTime(seg.startTime)}</Prop>
        <Prop label="End">{formatTime(seg.endTime)}</Prop>
        <Prop label="Duration">{duration.toFixed(2)}s</Prop>
      </div>

      <FieldGroup title="Fades">
        <NumberField
          label="Audio out"
          value={audioOut}
          step={0.1}
          min={0}
          max={duration}
          unit="s"
          onChange={(v) => setFade('audioOut', v)}
        />
        <NumberField
          label="Video out"
          value={videoOut}
          step={0.1}
          min={0}
          max={duration}
          unit="s"
          onChange={(v) => setFade('videoOut', v)}
        />
      </FieldGroup>

      <FieldGroup title="Video zoom">
        <NumberField
          label="Level"
          value={zoom.level}
          step={0.05}
          min={1.0}
          max={1.5}
          unit="×"
          onChange={(v) => setZoom('level', clamp(v, 1, 1.5))}
        />
        <NumberField
          label="Pan X"
          value={zoom.x}
          step={10}
          unit="px"
          onChange={(v) => setZoom('x', Math.round(v))}
        />
        <NumberField
          label="Pan Y"
          value={zoom.y}
          step={10}
          unit="px"
          onChange={(v) => setZoom('y', Math.round(v))}
        />
      </FieldGroup>

      <div className="field-group">
        <div className="field-group-header">
          <h3>Volume automation</h3>
          <button
            className="ghost"
            onClick={() => {
              const start = Math.max(seg.startTime, Math.min(seg.endTime - 1, currentTime ?? seg.startTime));
              addAutomationRegion({
                startTime: start,
                endTime: Math.min(seg.endTime, start + 3),
                gainDb: DEFAULT_APPLAUSE_GAIN_DB,
              });
            }}
          >
            + Add
          </button>
        </div>
        {automation.length === 0 ? (
          <div className="placeholder small">No volume automation. Use applause candidates below to add one.</div>
        ) : (
          <ul className="auto-list">
            {automation.map((a, i) => (
              <li key={i} className="auto-row">
                <NumberField
                  label="Start"
                  value={a.startTime}
                  step={0.1}
                  min={seg.startTime}
                  max={seg.endTime}
                  unit="s"
                  onChange={(v) => updateAutomationAt(i, (curr) => ({ ...curr, startTime: clamp(v, seg.startTime, a.endTime) }))}
                />
                <NumberField
                  label="End"
                  value={a.endTime}
                  step={0.1}
                  min={seg.startTime}
                  max={seg.endTime}
                  unit="s"
                  onChange={(v) => updateAutomationAt(i, (curr) => ({ ...curr, endTime: clamp(v, a.startTime, seg.endTime) }))}
                />
                <NumberField
                  label="Gain"
                  value={a.gainDb}
                  step={1}
                  max={0}
                  unit="dB"
                  onChange={(v) => updateAutomationAt(i, (curr) => ({ ...curr, gainDb: Math.min(0, v) }))}
                />
                <button className="ghost delete-auto" onClick={() => removeAutomationAt(i)} title="Remove">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {applauseInSegment.length > 0 && (
        <div className="field-group">
          <h3>Applause in this {kind}</h3>
          <ul className="applause-list">
            {applauseInSegment.map((a, i) => (
              <li key={i} className="applause-row">
                <span className="applause-time">
                  {formatTime(a.startTime).split('.')[0]} – {formatTime(a.endTime).split('.')[0]}
                </span>
                <span className="applause-conf">{Math.round((a.confidence ?? 0.5) * 100)}%</span>
                <button
                  className="ghost"
                  onClick={() => addAutomationRegion({
                    startTime: Math.max(seg.startTime, a.startTime),
                    endTime: Math.min(seg.endTime, a.endTime),
                    gainDb: DEFAULT_APPLAUSE_GAIN_DB,
                  })}
                  title="Add as -12 dB volume automation"
                >
                  + Automate
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FieldGroup({ title, children }) {
  return (
    <div className="field-group">
      <h3>{title}</h3>
      <div className="field-grid">{children}</div>
    </div>
  );
}

function NumberField({ label, value, step = 1, min, max, unit, onChange }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
        {unit && <span className="field-unit">{unit}</span>}
      </span>
    </label>
  );
}

function Prop({ label, children }) {
  return (
    <div className="prop">
      <span className="prop-label">{label}</span>
      <span className="prop-value">{children}</span>
    </div>
  );
}

function findSelected(project, id) {
  if (!project || !id) return null;
  for (const piece of project.pieces || []) {
    if (id === `piece-${piece.number}`) return { piece, kind: 'piece', label: pieceLabel(piece) };
    for (const m of piece.movements || []) {
      if (id === `mov-${piece.number}-${m.letter}`) {
        return { piece, movement: m, kind: 'movement', label: movementLabel(piece, m) };
      }
    }
  }
  return null;
}

function clamp(v, lo, hi) {
  if (lo == null) lo = -Infinity;
  if (hi == null) hi = Infinity;
  return Math.max(lo, Math.min(hi, v));
}
