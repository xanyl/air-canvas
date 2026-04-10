import { useState } from 'react';
import { ANALYSIS_MODES } from '../ai/apiClient';
import { GESTURE_META, type GestureType } from '../cv/gesture';
import { BRUSH_META, BRUSH_TYPES, LAYERS, type BrushType, type LayerId, type SymmetryMode } from '../draw/brushEngine';
import { TEMPLATE_PRESETS, type TemplatePreset } from '../draw/templates';
import type { OcrStatus } from '../hooks/useOCR';
import type { SessionAnalytics } from '../session/analytics';
import type { SessionRecord } from '../session/storage';
import type { AnalysisMode, AppMode, MathSolveResult } from '../types';
import { ReplayTimeline } from './ReplayTimeline';
import { SessionGallery } from './SessionGallery';

const PALETTE = ['#00e5ff', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#ffffff', '#f97316'];

export type ControlsState = {
  brushColor: string;
  brushSize: number;
  brushType: BrushType;
  precisionMode: boolean;
  mirror: boolean;
  showVideo: boolean;
  showDebug: boolean;
  showCVMask: boolean;
  showCVEdges: boolean;
  smoothingAlpha: number;
  pressureSensitivity: number;
  activeLayer: LayerId;
  layerVisibility: Record<LayerId, boolean>;
  symmetryMode: SymmetryMode;
  templatePreset: TemplatePreset;
  beautifyShapes: boolean;
};

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle-row">
      <span className="toggle-label">{label}</span>
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="toggle-track" />
      </label>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  fmt,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fmt?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="control-row">
      <div className="control-label">
        <span className="control-name">{label}</span>
        <span className="control-value">{fmt ? fmt(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function Controls(props: {
  mode: AppMode;
  state: ControlsState;
  onChange: (s: ControlsState) => void;
  cameraOn: boolean;
  gestureActive: GestureType;
  gestureConfidence: number;
  fps: number;
  totalStrokes: number;
  analytics: SessionAnalytics;
  mathHistory: MathSolveResult[];
  sessions: SessionRecord[];
  selectedSessionId: string | null;
  replayFrames: string[];
  replayIndex: number;
  replayPlaying: boolean;
  ocrStatus: OcrStatus;
  ocrText: string | null;
  currentPage: number;
  totalPages: number;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: (fmt: 'png' | 'jpg' | 'svg') => void;
  onToggleLayer: (id: LayerId) => void;
  onAiAnalyze: (mode: AnalysisMode) => void;
  onMathSolve: () => void;
  onOCR: () => void;
  onAddPage: () => void;
  onDeletePage: () => void;
  onSaveSession: (name: string, notes: string) => void;
  onLoadSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onBuildReplay: () => void;
  onReplayIndex: (idx: number) => void;
  onToggleReplay: () => void;
  onExportAnalytics: () => void;
}) {
  const s = props.state;
  const upd = (patch: Partial<ControlsState>) => props.onChange({ ...s, ...patch });

  const [showExport, setShowExport] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');

  const gestureMeta = GESTURE_META[props.gestureActive];

  return (
    <div className="panel">
      <div className="panel-body">
        {props.cameraOn && (
          <div className="gesture-card">
            <span className="gesture-card-emoji">{gestureMeta.emoji}</span>
            <div className="gesture-card-body">
              <div className="gesture-card-name">{gestureMeta.label}</div>
              <div className="gesture-card-action">{gestureMeta.action2D}</div>
            </div>
            <div className="gesture-card-stats">
              <div><span style={{ color: 'var(--cyan)' }}>{props.fps}</span> fps</div>
              <div><span style={{ color: 'var(--cyan)' }}>{Math.round(props.gestureConfidence * 100)}</span>%</div>
            </div>
          </div>
        )}

        <div>
          <div className="section-label">Brush</div>
          <div className="brush-grid">
            {BRUSH_TYPES.map((bt) => (
              <button key={bt} className={`brush-btn ${s.brushType === bt ? 'active' : ''}`} onClick={() => upd({ brushType: bt })}>
                <span className="brush-btn-icon">{BRUSH_META[bt].emoji}</span>
                {BRUSH_META[bt].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="section-label">Color</div>
          <div className="color-row">
            <div className="color-input-wrapper">
              <input type="color" value={s.brushColor} onChange={(e) => upd({ brushColor: e.target.value })} />
            </div>
            <div className="color-palette">
              {PALETTE.map((c) => (
                <div key={c} className={`color-swatch ${s.brushColor === c ? 'active' : ''}`} style={{ background: c }} onClick={() => upd({ brushColor: c })} />
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="section-label">Brush Settings</div>
          <Slider label="Size" value={s.brushSize} min={2} max={40} step={1} fmt={(v) => `${v}px`} onChange={(v) => upd({ brushSize: v })} />
          <div style={{ marginTop: 8 }}>
            <Slider
              label="Pressure"
              value={s.pressureSensitivity}
              min={0}
              max={1}
              step={0.05}
              fmt={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => upd({ pressureSensitivity: v })}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <Slider label="Smoothing" value={s.smoothingAlpha} min={0.05} max={0.95} step={0.01} fmt={(v) => v.toFixed(2)} onChange={(v) => upd({ smoothingAlpha: v })} />
          </div>
          <div style={{ marginTop: 8 }}>
            <Toggle label="Precision writing mode" checked={s.precisionMode} onChange={(v) => upd({ precisionMode: v })} />
          </div>
        </div>

        <div>
          <div className="section-label">Layers</div>
          <div className="layer-list">
            {LAYERS.map((l) => (
              <div key={l.id} className={`layer-item ${s.activeLayer === l.id ? 'active' : ''}`} onClick={() => upd({ activeLayer: l.id })}>
                <span className="layer-dot" style={{ background: l.color }} />
                <span className="layer-name">{l.name}</span>
                <button className="layer-vis-btn" onClick={(e) => { e.stopPropagation(); props.onToggleLayer(l.id); }}>
                  {s.layerVisibility[l.id] ? '👁️' : '🙈'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="section-label">Pages</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontFamily: 'var(--ff-mono)', color: 'var(--text-2)', flex: 1 }}>
              Page {props.currentPage + 1} of {props.totalPages}
            </span>
            <button className="btn btn-sm btn-primary" onClick={props.onAddPage} style={{ fontSize: 10, padding: '4px 10px' }}>
              + Add
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={props.onDeletePage}
              disabled={props.totalPages <= 1}
              style={{ fontSize: 10, padding: '4px 10px', opacity: props.totalPages <= 1 ? 0.4 : 1 }}
            >
              🗑
            </button>
          </div>
          <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--ff-mono)' }}>
            [ / ] to navigate · Cmd+N to add
          </div>
        </div>

        <div>
          <div className="section-label">Creative Tools</div>
          <div className="shape-grid">
            {(['off', 'horizontal', 'vertical', 'quad'] as SymmetryMode[]).map((mode) => (
              <button key={mode} className={`shape-btn ${s.symmetryMode === mode ? 'active' : ''}`} onClick={() => upd({ symmetryMode: mode })}>
                {mode}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            <Toggle label="Smart shape beautify" checked={s.beautifyShapes} onChange={(v) => upd({ beautifyShapes: v })} />
          </div>
          <div style={{ marginTop: 8 }}>
            <select className="modal-input" value={s.templatePreset} onChange={(e) => upd({ templatePreset: e.target.value as TemplatePreset })}>
              {TEMPLATE_PRESETS.map((template) => (
                <option key={template.id} value={template.id}>{template.emoji} {template.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="section-label">View</div>
          <Toggle label="Mirror" checked={s.mirror} onChange={(v) => upd({ mirror: v })} />
          <Toggle label="Show video" checked={s.showVideo} onChange={(v) => upd({ showVideo: v })} />
          <Toggle label="Skeleton overlay" checked={s.showDebug} onChange={(v) => upd({ showDebug: v })} />
          <Toggle label="OpenCV skin mask" checked={s.showCVMask} onChange={(v) => upd({ showCVMask: v })} />
          <Toggle label="OpenCV edge overlay" checked={s.showCVEdges} onChange={(v) => upd({ showCVEdges: v })} />
        </div>

        <div>
          <div className="section-label">Actions</div>
          <div className="action-grid">
            <button className="btn" onClick={props.onUndo}>↩ Undo</button>
            <button className="btn" onClick={props.onRedo}>↪ Redo</button>
            <button className="btn btn-danger" onClick={props.onClear}>🗑 Clear</button>
            <button className="btn btn-primary" onClick={props.mode === 'math' ? props.onMathSolve : () => setShowAI((v) => !v)}>
              {props.mode === 'math' ? '🧮 Solve (Fist)' : '✨ AI Analyze'}
            </button>
          </div>

          {showAI && props.mode === 'draw' && (
            <div className="export-menu" style={{ marginTop: 8 }}>
              {ANALYSIS_MODES.map((m) => (
                <button key={m.id} className="export-option" onClick={() => { setShowAI(false); props.onAiAnalyze(m.id); }}>
                  <span>{m.emoji}</span><span>{m.label}</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <button
              className="btn"
              style={{ width: '100%' }}
              onClick={props.onOCR}
              disabled={props.ocrStatus === 'recognizing'}
            >
              {props.ocrStatus === 'recognizing' ? '⏳ Recognizing…' : '📝 OCR — Read Text'}
            </button>
            {props.ocrText != null && (
              <div className="ocr-result" style={{ marginTop: 8 }}>
                <div className="ocr-result-header">
                  <span>Recognized Text</span>
                  <button
                    className="btn btn-sm"
                    onClick={() => { void navigator.clipboard.writeText(props.ocrText ?? ''); }}
                    style={{ fontSize: 9, padding: '3px 8px' }}
                  >
                    📋 Copy
                  </button>
                </div>
                <textarea
                  className="modal-input ocr-textarea"
                  readOnly
                  value={props.ocrText}
                  rows={Math.min(6, Math.max(2, (props.ocrText ?? '').split('\n').length))}
                />
              </div>
            )}
          </div>

          <div className="export-dropdown" style={{ marginTop: 8 }}>
            <button className="btn btn-export" style={{ width: '100%' }} onClick={() => setShowExport((v) => !v)}>
              💾 Export Drawing
            </button>
            {showExport && (
              <div className="export-menu">
                {(['png', 'jpg', 'svg'] as const).map((fmt) => (
                  <button key={fmt} className="export-option" onClick={() => { setShowExport(false); props.onExport(fmt); }}>
                    <span>📄</span><span>.{fmt.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="section-label">Save Session</div>
          <input className="modal-input" placeholder="Session name" value={sessionName} onChange={(e) => setSessionName(e.target.value)} />
          <textarea className="modal-input" placeholder="Notes" value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} rows={3} style={{ resize: 'vertical', marginTop: 6 }} />
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 8 }}
            onClick={() => {
              props.onSaveSession(sessionName || 'Untitled Session', sessionNotes);
              setSessionName('');
              setSessionNotes('');
            }}
          >
            Save Session
          </button>
        </div>

        <SessionGallery sessions={props.sessions} selectedId={props.selectedSessionId} onLoad={props.onLoadSession} onDelete={props.onDeleteSession} />

        <ReplayTimeline
          frames={props.replayFrames}
          frameIndex={props.replayIndex}
          isPlaying={props.replayPlaying}
          onBuild={props.onBuildReplay}
          onIndexChange={props.onReplayIndex}
          onTogglePlay={props.onToggleReplay}
        />

        <div>
          <div className="section-label">Analytics</div>
          <div className="inline-stats">
            <div className="inline-stats-row"><span>Strokes</span><span>{props.analytics.totalStrokes}</span></div>
            <div className="inline-stats-row"><span>Points</span><span>{props.analytics.totalPoints}</span></div>
            <div className="inline-stats-row"><span>Eraser</span><span>{props.analytics.eraserStrokes}</span></div>
            <div className="inline-stats-row"><span>Avg points/stroke</span><span>{props.analytics.averagePointsPerStroke.toFixed(1)}</span></div>
          </div>
          <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={props.onExportAnalytics}>Export Analytics JSON</button>
        </div>

        {props.mode === 'math' && (
          <div>
            <div className="section-label">Math History</div>
            <div className="object-list">
              {props.mathHistory.length === 0 && <div className="empty-box">No solved expressions yet.</div>}
              {props.mathHistory.map((entry) => (
                <div key={`${entry.createdAt}-${entry.expression}`} className="object-item">
                  <div className="object-info">
                    <div className="object-name">{entry.expression}</div>
                    <div className="object-pos">
                      = {entry.answer} · {Math.round(entry.confidence * 100)}% · AI
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="inline-stats">
          <div className="inline-stats-row"><span>FPS</span><span style={{ color: props.fps >= 25 ? 'var(--green)' : 'var(--orange)' }}>{props.fps}</span></div>
          <div className="inline-stats-row"><span>Total strokes</span><span style={{ color: 'var(--cyan)' }}>{props.totalStrokes}</span></div>
          <div className="inline-stats-row"><span>Mode</span><span style={{ color: 'var(--cyan)' }}>{props.mode}</span></div>
        </div>
      </div>
    </div>
  );
}
