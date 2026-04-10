import type { AppMode } from '../types';
import type { CVStatus } from '../hooks/useOpenCV';

type Props = {
  mode: AppMode;
  onMode: (m: AppMode) => void;
  cameraOn: boolean;
  onToggleCamera: () => void;
  status: string;
  statusType: 'idle' | 'active' | 'error';
  cvStatus: CVStatus;
  onLoadCV: () => void;
  zoomLevel: number;
  onResetView: () => void;
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export function ModeBar({
  mode,
  onMode,
  cameraOn,
  onToggleCamera,
  status,
  statusType,
  cvStatus,
  onLoadCV,
  zoomLevel,
  onResetView,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
}: Props) {
  const zoomPct = Math.round(zoomLevel * 100);

  return (
    <div className="mode-bar">
      <div className="mode-bar-brand">
        <div className="mode-bar-icon">🖐️</div>
        <div className="mode-bar-title">AirCanvas Final Studio</div>
      </div>

      <div className="mode-divider" />
      <div className="mode-tabs">
        <button className={`mode-tab ${mode === 'draw' ? 'active-2d' : ''}`} onClick={() => onMode('draw')}>
          <span className="mode-tab-emoji">🎨</span> Draw
        </button>
        <button className={`mode-tab ${mode === 'math' ? 'active-3d' : ''}`} onClick={() => onMode('math')}>
          <span className="mode-tab-emoji">🧮</span> Math
        </button>
      </div>

      <div className="mode-divider" />
      <div className="page-nav">
        <button className="page-nav-btn" onClick={onPrevPage} disabled={currentPage === 0}>◀</button>
        <span className="page-nav-label">{currentPage + 1} / {totalPages}</span>
        <button className="page-nav-btn" onClick={onNextPage} disabled={currentPage >= totalPages - 1}>▶</button>
      </div>

      <div className="mode-divider" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--ff-mono)' }}>OpenCV</span>
        {cvStatus === 'ready' && <span className="cv-chip ready">● Ready</span>}
        {cvStatus === 'loading' && <span className="cv-chip loading">⟳ Loading…</span>}
        {cvStatus === 'error' && <span className="cv-chip error">✕ Error</span>}
        {cvStatus === 'idle' && (
          <button className="btn btn-sm" onClick={onLoadCV} style={{ fontSize: 9.5, padding: '3px 8px' }}>
            Load
          </button>
        )}
      </div>

      {zoomPct !== 100 && (
        <>
          <div className="mode-divider" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="zoom-indicator">{zoomPct}%</span>
            <button className="btn btn-sm" onClick={onResetView} style={{ fontSize: 9, padding: '3px 8px' }}>
              Reset
            </button>
          </div>
        </>
      )}

      <div className="mode-bar-spacer" />
      <div className="mode-bar-status">
        <span className={`status-dot ${statusType === 'active' ? 'active' : statusType === 'error' ? 'error' : ''}`} />
        <span>{status}</span>
      </div>
      <div className="mode-divider" />
      <button className={`mode-bar-cam-btn ${cameraOn ? 'active' : ''}`} onClick={onToggleCamera}>
        {cameraOn ? '⏹ Stop' : '📷 Start Camera'}
      </button>
    </div>
  );
}
