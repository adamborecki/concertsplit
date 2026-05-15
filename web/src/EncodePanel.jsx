import { useCallback, useEffect, useRef, useState } from 'react';

export function EncodePanel({ disabled }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/encode/status');
      if (res.ok) {
        const j = await res.json();
        setJob(j);
        if (j.state === 'idle' || j.state === 'done' || j.state === 'partial' || j.state === 'error') {
          stopPolling();
        }
      }
    } catch {}
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    fetchStatus();
    return stopPolling;
  }, [fetchStatus]);

  const start = async (force = false) => {
    setError(null);
    try {
      const res = await fetch('/api/encode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Encode failed' }));
        setError(err.error);
        return;
      }
      const j = await res.json();
      setJob(j);
      stopPolling();
      pollRef.current = setInterval(fetchStatus, 500);
    } catch (e) {
      setError(e.message);
    }
  };

  const isRunning = job?.state === 'running';
  const tasks = job?.tasks || [];
  const done = tasks.filter((t) => t.status === 'done' || t.status === 'skipped').length;
  const errored = tasks.filter((t) => t.status === 'error').length;

  return (
    <div className="encode-panel">
      <div className="encode-header">
        <h2>Encode</h2>
        {tasks.length > 0 && (
          <span className="encode-count">
            {done}/{tasks.length}{errored > 0 ? ` · ${errored} error${errored === 1 ? '' : 's'}` : ''}
          </span>
        )}
      </div>

      <div className="encode-actions">
        <button onClick={() => start(false)} disabled={disabled || isRunning}>
          {isRunning ? 'Encoding…' : 'Encode'}
        </button>
        <button
          className="secondary"
          onClick={() => start(true)}
          disabled={disabled || isRunning}
          title="Re-encode all segments, overwriting existing files"
        >
          Re-encode all
        </button>
      </div>

      {error && <div className="encode-error">{error}</div>}
      {job?.error && <div className="encode-error">{job.error}</div>}

      {tasks.length > 0 && (
        <div className="encode-progress">
          <div
            className="encode-progress-bar"
            style={{ width: `${Math.round((done / tasks.length) * 100)}%` }}
          />
        </div>
      )}

      {tasks.length > 0 && (
        <ul className="task-list">
          {tasks.map((t) => (
            <li key={t.id} className={`task task--${t.status}`}>
              <span className="task-name">{t.id}</span>
              <span className="task-status">{statusLabel(t.status)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function statusLabel(s) {
  switch (s) {
    case 'pending': return '·';
    case 'running': return '…';
    case 'done': return '✓';
    case 'skipped': return 'skipped';
    case 'error': return '!';
    default: return s;
  }
}
