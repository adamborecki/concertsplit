import { useState } from 'react';
import { movementLabel, pieceLabel } from './pieces.js';
import { formatTime } from './time.js';

export function PiecesPanel({ project, selectedId, onSelect, onRemove, onSeek, onUpdateTitle }) {
  const pieces = project.pieces ?? [];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Pieces</h2>
        <span className="count">{pieces.length}</span>
      </div>

      {pieces.length === 0 ? (
        <div className="placeholder">
          No pieces yet. Click <strong>Add piece</strong> below to mark a piece at the current playhead.
        </div>
      ) : (
        <ul className="tree">
          {pieces.map((p) => (
            <PieceItem
              key={p.number}
              piece={p}
              selectedId={selectedId}
              onSelect={onSelect}
              onRemove={onRemove}
              onSeek={onSeek}
              onUpdateTitle={onUpdateTitle}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PieceItem({ piece, selectedId, onSelect, onRemove, onSeek, onUpdateTitle }) {
  const pieceId = `piece-${piece.number}`;
  const isSelected = selectedId === pieceId;

  return (
    <li className="piece">
      <Row
        id={pieceId}
        kind="piece"
        label={pieceLabel(piece)}
        title={piece.title}
        startTime={piece.startTime}
        endTime={piece.endTime}
        selected={isSelected}
        onSelect={onSelect}
        onRemove={onRemove}
        onSeek={onSeek}
        onUpdateTitle={onUpdateTitle}
      />
      {(piece.movements?.length ?? 0) > 0 && (
        <ul className="movements">
          {piece.movements.map((m) => {
            const movId = `mov-${piece.number}-${m.letter}`;
            return (
              <li className="movement" key={movId}>
                <Row
                  id={movId}
                  kind="movement"
                  label={movementLabel(piece, m)}
                  title={m.title}
                  startTime={m.startTime}
                  endTime={m.endTime}
                  selected={selectedId === movId}
                  onSelect={onSelect}
                  onRemove={onRemove}
                  onSeek={onSeek}
                  onUpdateTitle={onUpdateTitle}
                />
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function Row({ id, kind, label, title, startTime, endTime, selected, onSelect, onRemove, onSeek, onUpdateTitle }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title ?? '');

  const dur = endTime - startTime;
  return (
    <div className={`row ${selected ? 'is-selected' : ''}`} onClick={() => onSelect(id)}>
      <div className="row-main">
        <span className="badge">{label}</span>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              onUpdateTitle(id, draft.trim() || null);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setDraft(title ?? '');
                setEditing(false);
              }
            }}
            className="title-input"
            placeholder={kind === 'piece' ? 'Piece title…' : 'Movement title…'}
          />
        ) : (
          <button
            className="title"
            onClick={(e) => {
              e.stopPropagation();
              setDraft(title ?? '');
              setEditing(true);
            }}
            title="Click to edit"
          >
            {title || <span className="muted">{kind === 'piece' ? 'Untitled piece' : 'Untitled movement'}</span>}
          </button>
        )}
      </div>
      <div className="row-meta">
        <button
          className="time-button"
          onClick={(e) => {
            e.stopPropagation();
            onSeek(startTime);
          }}
          title="Seek to start"
        >
          {formatTime(startTime).split('.')[0]}
        </button>
        <span className="dur">{dur.toFixed(1)}s</span>
        <button
          className="delete"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Remove ${label}?`)) onRemove(id);
          }}
          title="Remove"
        >
          ×
        </button>
      </div>
    </div>
  );
}
