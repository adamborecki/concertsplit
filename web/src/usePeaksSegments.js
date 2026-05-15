import { useEffect } from 'react';
import { movementLabel, movementsAndPieceColors, pieceLabel } from './pieces.js';

export function usePeaksSegments({ peaks, project, selectedId, onSegmentChange }) {
  useEffect(() => {
    if (!peaks || !project) return;
    const segments = peaks.segments;
    segments.removeAll();

    const items = [];
    (project.pieces || []).forEach((p, i) => {
      const colors = movementsAndPieceColors(i);
      const pieceId = `piece-${p.number}`;
      items.push({
        id: pieceId,
        startTime: p.startTime,
        endTime: p.endTime,
        labelText: pieceLabel(p),
        color: colors.pieceColor,
        borderColor: selectedId === pieceId ? '#fff' : colors.pieceBorderColor,
        editable: true,
      });
      (p.movements || []).forEach((m) => {
        const mid = `mov-${p.number}-${m.letter}`;
        items.push({
          id: mid,
          startTime: m.startTime,
          endTime: m.endTime,
          labelText: movementLabel(p, m),
          color: colors.movementColor,
          borderColor: selectedId === mid ? '#fff' : colors.movementBorderColor,
          editable: true,
        });
      });
    });

    segments.add(items);
  }, [peaks, project, selectedId]);

  useEffect(() => {
    if (!peaks || !onSegmentChange) return;
    const handler = ({ segment }) => onSegmentChange(segment.id, segment.startTime, segment.endTime);
    peaks.on('segments.dragend', handler);
    return () => peaks.off('segments.dragend', handler);
  }, [peaks, onSegmentChange]);
}
