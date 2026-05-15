const MOVEMENT_LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export const DEFAULT_FADES = { audioOut: 4.0, videoOut: 2.0 };
export const DEFAULT_ZOOM = { level: 1.0, x: 0, y: 0 };

export function pieceLabel(piece) {
  return String(piece.number).padStart(2, '0');
}

export function movementLabel(piece, movement) {
  return `${pieceLabel(piece)}${movement.letter}`;
}

export function renumber(pieces) {
  const sorted = [...pieces].sort((a, b) => a.startTime - b.startTime);
  return sorted.map((p, i) => {
    const sortedMovements = [...(p.movements || [])].sort((a, b) => a.startTime - b.startTime);
    return {
      ...p,
      number: i + 1,
      movements: sortedMovements.map((m, j) => ({ ...m, letter: MOVEMENT_LETTERS[j] })),
    };
  });
}

export function newPiece({ startTime, endTime }) {
  return {
    number: 0,
    startTime,
    endTime,
    fades: { ...DEFAULT_FADES },
    zoom: { ...DEFAULT_ZOOM },
    automation: [],
    movements: [],
  };
}

export function newMovement({ startTime, endTime }) {
  return {
    letter: 'a',
    startTime,
    endTime,
    fades: { ...DEFAULT_FADES },
    zoom: { ...DEFAULT_ZOOM },
    automation: [],
  };
}

export function findPieceContaining(pieces, time) {
  return pieces.find((p) => time >= p.startTime && time <= p.endTime);
}

export function defaultSegmentSpan(currentTime, duration, fallback = 30) {
  const start = Math.max(0, currentTime);
  const end = Math.min(duration || Infinity, start + fallback);
  return { startTime: start, endTime: end };
}

export function movementsAndPieceColors(pieceIndex) {
  const hues = [200, 270, 130, 30, 330, 180, 50, 290];
  const h = hues[pieceIndex % hues.length];
  return {
    pieceColor: `hsla(${h}, 70%, 55%, 0.18)`,
    pieceBorderColor: `hsla(${h}, 70%, 60%, 0.9)`,
    movementColor: `hsla(${h}, 50%, 45%, 0.28)`,
    movementBorderColor: `hsla(${h}, 60%, 55%, 0.8)`,
  };
}
