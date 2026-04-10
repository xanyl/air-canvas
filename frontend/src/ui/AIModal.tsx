type Props = { title: string; loading: boolean; result: string | null; error: string | null; onClose: () => void };

export function AIModal({ title, loading, result, error, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <span>🤖</span>
          <span style={{ flex: 1 }}>{title}</span>
          <button className="btn btn-sm" onClick={onClose} style={{ padding: '4px 10px' }}>✕</button>
        </div>
        <div className="modal-content">
          {loading && (
            <div className="ai-thinking">
              <span>AI is processing your canvas</span>
              <div className="ai-dots"><span /><span /><span /></div>
            </div>
          )}
          {!loading && error && <div style={{ color: 'var(--rose)', fontSize: 12 }}><strong>Error:</strong> {error}</div>}
          {!loading && result && (
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, color: 'var(--text-1)', fontSize: 13 }}>
              {result}
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
