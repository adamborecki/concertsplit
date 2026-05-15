export function Topbar({ project }) {
  return (
    <div className="topbar">
      <h1>concertsplit</h1>
      <span className="subtle">{project.project.name}</span>
      <span className="subtle">·</span>
      <span className="subtle">{project.project.masterFile}</span>
      <div className="spacer" />
    </div>
  );
}
