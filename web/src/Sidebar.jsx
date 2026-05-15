export function Sidebar({ project }) {
  const count = project.pieces?.length ?? 0;
  return (
    <div className="sidebar">
      <h2>Pieces</h2>
      {count === 0 ? (
        <div className="placeholder">
          No pieces yet. Segment marking coming in #5.
        </div>
      ) : (
        <ul>
          {project.pieces.map((p) => (
            <li key={p.number}>
              {String(p.number).padStart(2, '0')}
              {p.title ? ` — ${p.title}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
