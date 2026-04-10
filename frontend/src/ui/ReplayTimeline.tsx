type Props = {
  frames: string[];
  frameIndex: number;
  isPlaying: boolean;
  onIndexChange: (idx: number) => void;
  onTogglePlay: () => void;
  onBuild: () => void;
};

export function ReplayTimeline({
  frames,
  frameIndex,
  isPlaying,
  onIndexChange,
  onTogglePlay,
  onBuild,
}: Props) {
  return (
    <div>
      <div className="section-label">Timelapse Replay</div>
      <div className="action-grid">
        <button className="btn" onClick={onBuild}>Build Frames</button>
        <button className="btn btn-primary" onClick={onTogglePlay} disabled={frames.length === 0}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>
      <div className="control-row" style={{ marginTop: 8 }}>
        <div className="control-label">
          <span className="control-name">Frame</span>
          <span className="control-value">{frames.length === 0 ? '0/0' : `${frameIndex + 1}/${frames.length}`}</span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={frameIndex}
          onChange={(e) => onIndexChange(Number(e.target.value))}
          disabled={frames.length === 0}
        />
      </div>
    </div>
  );
}
