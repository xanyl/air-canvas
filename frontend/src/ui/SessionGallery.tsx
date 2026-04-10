import type { SessionRecord } from '../session/storage';

type Props = {
  sessions: SessionRecord[];
  selectedId: string | null;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
};

export function SessionGallery({ sessions, selectedId, onLoad, onDelete }: Props) {
  return (
    <div>
      <div className="section-label">Session Gallery ({sessions.length})</div>
      {sessions.length === 0 ? (
        <div className="empty-box">No sessions saved yet.</div>
      ) : (
        <div className="object-list">
          {sessions.map((session) => (
            <div key={session.id} className={`object-item ${selectedId === session.id ? 'selected' : ''}`}>
              <img src={session.previewDataUrl} alt={session.name} className="session-thumb" />
              <div className="object-info">
                <div className="object-name">{session.name}</div>
                <div className="object-pos">{new Date(session.updatedAt).toLocaleString()}</div>
              </div>
              <button className="btn btn-sm" onClick={() => onLoad(session.id)}>
                Load
              </button>
              <button className="object-del-btn" onClick={() => onDelete(session.id)}>
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
