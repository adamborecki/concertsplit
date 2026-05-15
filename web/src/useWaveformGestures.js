import { useEffect, useRef } from 'react';

const MIN_SECONDS = 5;
const MAX_SECONDS = 7200;

export function useWaveformGestures({ containerRef, peaks, videoRef }) {
  const secondsVisibleRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !peaks) return;

    const view = peaks.views.getView('zoomview');
    if (!view) return;

    const applyZoom = (newSeconds) => {
      const clamped = Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, newSeconds));
      secondsVisibleRef.current = clamped;
      view.setZoom({ seconds: clamped });
    };

    const getSecondsVisible = () => {
      if (secondsVisibleRef.current !== null) return secondsVisibleRef.current;
      // Bootstrap from current zoom level on first gesture
      const width = el.clientWidth || 1000;
      const pps = view.timeToPixels ? view.timeToPixels(1) : 50;
      return width / (pps || 50);
    };

    const onWheel = (e) => {
      e.preventDefault();

      if (e.ctrlKey) {
        // Trackpad pinch: deltaY is proportional to pinch speed, use it as a multiplier
        const factor = 1 + e.deltaY * 0.01;
        applyZoom(getSecondsVisible() * factor);
        return;
      }

      // Horizontal swipe / scroll → scroll the waveform
      const delta = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 1) return;
      view.scrollWaveform({ pixels: delta });
    };

    // Touch pinch — use raw ratio each frame for smooth continuous zoom
    let lastDist = null;

    const onTouchStart = (e) => {
      if (e.touches.length === 2) lastDist = pinchDist(e.touches);
    };

    const onTouchMove = (e) => {
      if (e.touches.length !== 2 || lastDist === null) return;
      e.preventDefault();
      const dist = pinchDist(e.touches);
      const ratio = lastDist / dist; // >1 = pinching in = zoom in (fewer seconds visible)
      lastDist = dist;
      applyZoom(getSecondsVisible() * ratio);
    };

    const onTouchEnd = () => { lastDist = null; };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [containerRef, peaks, videoRef]);
}

function pinchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}
