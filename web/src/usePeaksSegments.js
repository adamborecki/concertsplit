import { useEffect } from 'react';
import { movementLabel, movementsAndPieceColors, pieceLabel } from './pieces.js';

export function usePeaksSegments({ peaks, project, selectedId, applause, onSegmentChange }) {
  useEffect(() => {
    if (!peaks || !project) return;
    const segments = peaks.segments;
    segments.removeAll();

    const items = [];
    (applause || []).forEach((a, i) => {
      items.push({
        id: `applause-${i}`,
        startTime: a.startTime,
        endTime: a.endTime,
        color: 'rgba(255, 196, 80, 0.18)',
        borderColor: 'rgba(255, 196, 80, 0.55)',
        labelText: '👏',
        editable: false,
      });
    });

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

      // Automation overlays (per piece + per movement) shown as muted bars
      const autos = [
        ...(p.automation || []).map((a) => ({ a, parent: pieceId })),
        ...(p.movements || []).flatMap((m) =>
          (m.automation || []).map((a) => ({ a, parent: `mov-${p.number}-${m.letter}` })),
        ),
      ];
      autos.forEach(({ a, parent }, idx) => {
        items.push({
          id: `auto-${parent}-${idx}`,
          startTime: a.startTime,
          endTime: a.endTime,
          color: 'rgba(180, 80, 200, 0.16)',
          borderColor: 'rgba(180, 80, 200, 0.55)',
          labelText: `${a.gainDb}dB`,
          editable: false,
        });
      });
    });

    segments.add(items);
  }, [peaks, project, selectedId, applause]);

  useEffect(() => {
    if (!peaks || !onSegmentChange) return;
    const handler = ({ segment }) => {
      // Only react to piece/movement drag, not applause/automation overlays
      if (!segment.id.startsWith('piece-') && !segment.id.startsWith('mov-')) return;
      onSegmentChange(segment.id, segment.startTime, segment.endTime);
    };
    peaks.on('segments.dragend', handler);
    return () => peaks.off('segments.dragend', handler);
  }, [peaks, onSegmentChange]);
}
