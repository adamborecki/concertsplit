export function Bottombar() {
  return (
    <div className="bottombar">
      <span><kbd>Space</kbd> play/pause</span>
      <span><kbd>+</kbd> / <kbd>−</kbd> zoom</span>
      <span><kbd>←</kbd> / <kbd>→</kbd> scrub (Shift = 0.1s)</span>
      <span><kbd>P</kbd> add piece</span>
      <span><kbd>V</kbd> add movement</span>
      <span><kbd>⌫</kbd> remove selected</span>
      <span><kbd>0</kbd> start</span>
    </div>
  );
}
