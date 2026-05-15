export function Topbar({ project, savingState }) {
  const saveLabel =
    savingState === 'saving' ? 'Saving…' :
    savingState === 'saved' ? 'Saved' :
    savingState === 'error' ? 'Save error' : '';
  return (
    <div className="topbar">
      <h1>concertsplit</h1>
      <span className="dot" />
      <span className="project-name">{project.project.name}</span>
      <span className="subtle">{project.project.masterFile}</span>
      <div className="spacer" />
      {saveLabel && <span className={`save-state save-state--${savingState}`}>{saveLabel}</span>}
    </div>
  );
}
