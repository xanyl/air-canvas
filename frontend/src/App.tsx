import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { analyzeCanvasImage, solveMathImage } from './ai/apiClient';
import {
  GESTURE_META,
  GestureProcessor,
  INDEX_MCP,
  INDEX_TIP,
  THUMB_TIP,
  WRIST,
  classifySecondHand,
  dist,
  type GestureType,
  type Point,
} from './cv/gesture';
import { createHandLandmarker } from './cv/handLandmarker';
import { estimateSpeed, pressureSize, zToPressure } from './cv/pressure';
import { beautifyStroke } from './draw/shapeBeautify';
import {
  clearAll,
  countStrokes,
  createInitialState,
  endStroke,
  redo,
  setActiveLayer,
  toggleLayerVisibility,
  undo,
  addPoint,
  startStroke,
  addPage,
  goToPage,
  deletePage,
  getPageCount,
  migrateState,
  type BrushEngineState,
} from './draw/brushEngine';
import { generateReplayFrames } from './draw/replay';
import { exportToCanvas, renderCursor, renderDebug, renderDrawing } from './draw/renderer';
import { OneEuroFilter } from './draw/smoothing';
import { drawTemplate } from './draw/templates';
import { useFPS } from './hooks/useFPS';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useOCR } from './hooks/useOCR';
import { useOpenCV } from './hooks/useOpenCV';
import { useToast } from './hooks/useToast';
import { cannyEdges } from './opencv/edgeDetect';
import { isCVReady } from './opencv/opencvLoader';
import { detectSkin } from './opencv/skinDetect';
import { computeAnalytics } from './session/analytics';
import { deleteSession, loadSessions, saveSession, type SessionRecord } from './session/storage';
import type { AppMode, AnalysisMode, MathSolveResult } from './types';
import { AIModal } from './ui/AIModal';
import { Controls, type ControlsState } from './ui/Controls';
import { ModeBar } from './ui/ModeBar';

import './styles.css';

type ViewTransform = { scale: number; offsetX: number; offsetY: number };

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

const ROCK_ANALYZE_HOLD_MS = 950;
const FIST_SOLVE_HOLD_MS = 760;
const MATH_RESULT_POP_MS = 5200;

export default function App() {
  const [mode, setMode] = useState<AppMode>('draw');
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState('Click Start Camera to begin');
  const [statusType, setStatusType] = useState<'idle' | 'active' | 'error'>('idle');
  const [gestureActive, setGestureActive] = useState<GestureType>('NONE');
  const [gestureConf, setGestureConf] = useState(0);
  const [totalStrokes, setTotalStrokes] = useState(0);
  const [mathHistory, setMathHistory] = useState<MathSolveResult[]>([]);
  const [latestMathResult, setLatestMathResult] = useState<MathSolveResult | null>(null);
  const [showMathResultPop, setShowMathResultPop] = useState(false);
  const [drawVersion, setDrawVersion] = useState(0);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiModalTitle, setAiModalTitle] = useState('Canvas AI');
  const [showAiModal, setShowAiModal] = useState(false);

  const [sessions, setSessions] = useState<SessionRecord[]>(() => loadSessions());
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [replayFrames, setReplayFrames] = useState<string[]>([]);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);

  // OCR state
  const [ocrText, setOcrText] = useState<string | null>(null);

  // Multi-hand zoom/pan state
  const [viewTransform, setViewTransform] = useState<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const viewTransformRef = useRef<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const secondHandPrevRef = useRef<{ pinchDist: number; midX: number; midY: number } | null>(null);
  const secondHandActiveRef = useRef(false);

  const [controls, setControls] = useState<ControlsState>({
    brushColor: '#00e5ff',
    brushSize: 10,
    brushType: 'neon',
    precisionMode: false,
    mirror: true,
    showVideo: true,
    showDebug: false,
    showCVMask: false,
    showCVEdges: false,
    smoothingAlpha: 0.35,
    pressureSensitivity: 0.5,
    activeLayer: 'canvas',
    layerVisibility: { background: true, canvas: true, overlay: true },
    symmetryMode: 'off',
    templatePreset: 'none',
    beautifyShapes: true,
  });
  const controlsRef = useRef(controls);

  const videoRef = useRef<HTMLVideoElement>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const debugRef = useRef<HTMLCanvasElement>(null);
  const cvMaskRef = useRef<HTMLCanvasElement>(null);
  const cvEdgeRef = useRef<HTMLCanvasElement>(null);
  const templateRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const landmarkerRef = useRef<Awaited<ReturnType<typeof createHandLandmarker>> | null>(null);
  const gestureProcRef = useRef(new GestureProcessor(3));
  const filterRef = useRef<OneEuroFilter | null>(null);
  const cursorRef = useRef<Point | null>(null);
  const prevCursorRef = useRef<Point | null>(null);
  const brushRef = useRef<BrushEngineState>(createInitialState());
  const isDrawingRef = useRef(false);
  const isErasingRef = useRef(false);
  const holdGestureRef = useRef<GestureType>('NONE');
  const triggerHoldStartRef = useRef<number | null>(null);
  const actionTriggeredRef = useRef(false);
  const mathResultTimerRef = useRef<number | null>(null);
  const cvFrameCounterRef = useRef(0);
  const replayTimerRef = useRef<number | null>(null);
  const pinchLatchedRef = useRef(false);
  const pinchOnFramesRef = useRef(0);
  const pinchOffFramesRef = useRef(0);
  const stablePointRef = useRef<Point | null>(null);
  const trailRef = useRef<Point[]>([]);

  const { fps, tick: fpsTick } = useFPS();
  const { toasts, show: showToast } = useToast();
  const { status: cvStatus, load: loadCV } = useOpenCV();
  const { recognize: ocrRecognize, status: ocrStatus } = useOCR();

  useEffect(() => {
    controlsRef.current = controls;
    brushRef.current = setActiveLayer(brushRef.current, controls.activeLayer);
  }, [controls]);

  const analytics = useMemo(() => computeAnalytics(brushRef.current), [drawVersion]);

  const clamp01 = useCallback((v: number) => Math.max(0, Math.min(1, v)), []);

  const remapToDrawZone = useCallback((p: Point, precisionMode: boolean): Point => {
    const padX = precisionMode ? 0.08 : 0.055;
    const padY = precisionMode ? 0.1 : 0.065;
    const mappedX = clamp01((p.x - padX) / (1 - padX * 2));
    const mappedY = clamp01((p.y - padY) / (1 - padY * 2));
    return { ...p, x: mappedX, y: mappedY };
  }, [clamp01]);

  const stabilizePointer = useCallback((p: Point, precisionMode: boolean): Point => {
    const prev = stablePointRef.current ?? p;
    let target = p;
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    const jump = Math.hypot(dx, dy);
    const maxJump = precisionMode ? 0.04 : 0.06;
    if (jump > maxJump) {
      const scale = maxJump / jump;
      target = { ...p, x: prev.x + dx * scale, y: prev.y + dy * scale };
    }

    const deadZone = precisionMode ? 0.00045 : 0.0008;
    if (jump < deadZone) {
      target = { ...target, x: prev.x, y: prev.y };
    }

    trailRef.current.push(target);
    const maxTrail = precisionMode ? 3 : 2;
    if (trailRef.current.length > maxTrail) trailRef.current.shift();

    let sumX = 0;
    let sumY = 0;
    let sumW = 0;
    for (let i = 0; i < trailRef.current.length; i++) {
      const w = i + 1;
      sumX += trailRef.current[i].x * w;
      sumY += trailRef.current[i].y * w;
      sumW += w;
    }
    const averaged: Point = { ...target, x: sumX / sumW, y: sumY / sumW };

    const alpha = precisionMode ? 0.5 : 0.68;
    const out: Point = {
      ...averaged,
      x: prev.x + (averaged.x - prev.x) * alpha,
      y: prev.y + (averaged.y - prev.y) * alpha,
    };
    stablePointRef.current = out;
    return out;
  }, []);

  const pinchRatio = useCallback((lm: Array<{ x: number; y: number; z?: number }>): number => {
    if (lm.length <= INDEX_TIP) return 999;
    const thumb = lm[THUMB_TIP];
    const index = lm[INDEX_TIP];
    const wrist = lm[WRIST];
    const indexMcp = lm[INDEX_MCP];
    const pinch = Math.hypot(index.x - thumb.x, index.y - thumb.y);
    const handSize = Math.hypot(indexMcp.x - wrist.x, indexMcp.y - wrist.y);
    return pinch / Math.max(handSize, 0.001);
  }, []);

  const updatePinchLatch = useCallback((ratio: number, precisionMode: boolean): boolean => {
    const enterThreshold = precisionMode ? 0.31 : 0.29;
    const exitThreshold = precisionMode ? 0.43 : 0.4;
    if (ratio <= enterThreshold) {
      pinchOnFramesRef.current += 1;
      pinchOffFramesRef.current = 0;
    } else if (ratio >= exitThreshold) {
      pinchOffFramesRef.current += 1;
      pinchOnFramesRef.current = 0;
    } else {
      pinchOnFramesRef.current = Math.max(0, pinchOnFramesRef.current - 1);
      pinchOffFramesRef.current = Math.max(0, pinchOffFramesRef.current - 1);
    }

    const confirmFrames = precisionMode ? 2 : 1;
    if (!pinchLatchedRef.current && pinchOnFramesRef.current >= confirmFrames) {
      pinchLatchedRef.current = true;
      pinchOnFramesRef.current = 0;
    }
    if (pinchLatchedRef.current && pinchOffFramesRef.current >= confirmFrames) {
      pinchLatchedRef.current = false;
      pinchOffFramesRef.current = 0;
    }
    return pinchLatchedRef.current;
  }, []);

  const endDrawOrErase = useCallback(() => {
    if (isDrawingRef.current) {
      brushRef.current = endStroke(brushRef.current, controlsRef.current.beautifyShapes ? beautifyStroke : undefined);
      isDrawingRef.current = false;
      setDrawVersion((v) => v + 1);
    }
    if (isErasingRef.current) {
      brushRef.current = endStroke(brushRef.current);
      isErasingRef.current = false;
      setDrawVersion((v) => v + 1);
    }
  }, []);

  const syncCanvases = useCallback(() => {
    const video = videoRef.current;
    const draw = drawRef.current;
    const debug = debugRef.current;
    const cvMask = cvMaskRef.current;
    const cvEdge = cvEdgeRef.current;
    const template = templateRef.current;
    if (!video || !draw || !debug || !cvMask || !cvEdge || !template) return;

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    draw.width = w; draw.height = h;
    debug.width = w; debug.height = h;
    cvMask.width = w; cvMask.height = h;
    cvEdge.width = w; cvEdge.height = h;
    template.width = w; template.height = h;
    const tctx = template.getContext('2d');
    if (tctx) drawTemplate(tctx, controlsRef.current.templatePreset);
  }, []);

  useEffect(() => {
    const canvas = templateRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawTemplate(ctx, controls.templatePreset);
  }, [controls.templatePreset, cameraOn]);

  const ensureLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    const lm = await createHandLandmarker({
      modelAssetPath: MODEL_URL,
      numHands: 1,
      delegate: 'GPU',
    });
    landmarkerRef.current = lm;
    return lm;
  }, []);

  const base64FromCanvas = useCallback((canvas: HTMLCanvasElement) => canvas.toDataURL('image/png').split(',')[1], []);

  const handleAiAnalyze = useCallback(async (analysisMode: AnalysisMode) => {
    const draw = drawRef.current;
    if (!draw) return;
    const total = countStrokes(brushRef.current);
    if (total === 0) {
      showToast('Draw something first');
      return;
    }

    setShowAiModal(true);
    setAiModalTitle('AI Art Analysis');
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);

    try {
      const img = exportToCanvas(brushRef.current, draw.width, draw.height);
      const res = await analyzeCanvasImage(base64FromCanvas(img), analysisMode);
      setAiResult(res.text);
      setStatus(`AI done (${res.latencyMs}ms)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      setAiError(message);
      setStatus('AI request failed');
      setStatusType('error');
    } finally {
      setAiLoading(false);
    }
  }, [base64FromCanvas, showToast]);

  const handleMathSolve = useCallback(async () => {
    const draw = drawRef.current;
    if (!draw) return;
    const total = countStrokes(brushRef.current);
    if (total === 0) {
      showToast('Write an expression first');
      return;
    }

    setShowAiModal(true);
    setAiModalTitle('AI Math Solver');
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);

    try {
      const img = exportToCanvas(brushRef.current, draw.width, draw.height);
      const result = await solveMathImage(base64FromCanvas(img));
      setMathHistory((prev) => [result, ...prev].slice(0, 30));
      setLatestMathResult(result);
      setAiResult(
        `${result.expression}\n= ${result.answer}\nConfidence: ${Math.round(result.confidence * 100)}%\nProvider: AI\nLatency: ${result.latencyMs}ms`,
      );
      setShowMathResultPop(true);
      if (mathResultTimerRef.current) window.clearTimeout(mathResultTimerRef.current);
      mathResultTimerRef.current = window.setTimeout(() => setShowMathResultPop(false), MATH_RESULT_POP_MS);
      setStatus(`Solved: ${result.answer}`);
      setStatusType('active');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Math solve failed';
      setAiError(message);
      setStatus('Math solve failed');
      setStatusType('error');
    } finally {
      setAiLoading(false);
    }
  }, [base64FromCanvas, showToast]);

  const doUndo = useCallback(() => {
    brushRef.current = undo(brushRef.current);
    setDrawVersion((v) => v + 1);
    showToast('Undo');
  }, [showToast]);

  const doRedo = useCallback(() => {
    brushRef.current = redo(brushRef.current);
    setDrawVersion((v) => v + 1);
    showToast('Redo');
  }, [showToast]);

  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.srcObject = null;
      }
      endDrawOrErase();
      filterRef.current = null;
      stablePointRef.current = null;
      trailRef.current = [];
      holdGestureRef.current = 'NONE';
      triggerHoldStartRef.current = null;
      actionTriggeredRef.current = false;
      pinchLatchedRef.current = false;
      pinchOnFramesRef.current = 0;
      pinchOffFramesRef.current = 0;
      setCameraOn(false);
      setStatus('Camera stopped');
      setStatusType('idle');
      return;
    }

    try {
      setStatus('Requesting camera…');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      await ensureLandmarker();
      syncCanvases();
      video.onloadedmetadata = syncCanvases;
      setCameraOn(true);
      setStatus('Ready — show your hand');
      setStatusType('active');
    } catch {
      setStatus('Camera access denied');
      setStatusType('error');
    }
  }, [cameraOn, endDrawOrErase, ensureLandmarker, syncCanvases]);

  const handleExport = useCallback((fmt: 'png' | 'jpg' | 'svg') => {
    const draw = drawRef.current;
    if (!draw) return;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const exp = exportToCanvas(brushRef.current, draw.width || 1280, draw.height || 720);
    if (fmt === 'svg') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${exp.width}" height="${exp.height}"><image href="${exp.toDataURL('image/png')}" width="${exp.width}" height="${exp.height}"/></svg>`;
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aircanvas-${ts}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const mime = fmt === 'jpg' ? 'image/jpeg' : 'image/png';
    exp.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aircanvas-${ts}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    }, mime, 0.93);
  }, []);

  const saveCurrentSession = useCallback((name: string, notes: string) => {
    const draw = drawRef.current;
    if (!draw) return;
    const preview = exportToCanvas(brushRef.current, draw.width, draw.height).toDataURL('image/png');
    const record = saveSession({
      name: name.trim() || 'Untitled Session',
      notes,
      previewDataUrl: preview,
      brushState: JSON.parse(JSON.stringify(brushRef.current)) as BrushEngineState,
      mathHistory,
      analytics: computeAnalytics(brushRef.current),
    });
    setSessions(loadSessions());
    setSelectedSessionId(record.id);
    showToast('Session saved');
  }, [mathHistory, showToast]);

  const loadSavedSession = useCallback((id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    const raw = JSON.parse(JSON.stringify(session.brushState)) as BrushEngineState;
    brushRef.current = migrateState(raw);
    setMathHistory(session.mathHistory || []);
    setLatestMathResult(session.mathHistory?.[0] ?? null);
    setControls((prev) => ({
      ...prev,
      activeLayer: session.brushState.activeLayer,
      layerVisibility: {
        background: session.brushState.layers.background.visible,
        canvas: session.brushState.layers.canvas.visible,
        overlay: session.brushState.layers.overlay.visible,
      },
    }));
    setSelectedSessionId(id);
    setDrawVersion((v) => v + 1);
    showToast(`Loaded ${session.name}`);
  }, [sessions, showToast]);

  const deleteSavedSession = useCallback((id: string) => {
    setSessions(deleteSession(id));
    if (selectedSessionId === id) setSelectedSessionId(null);
    showToast('Session deleted');
  }, [selectedSessionId, showToast]);

  const buildReplay = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;
    const frames = generateReplayFrames(brushRef.current, draw.width, draw.height, 50);
    setReplayFrames(frames);
    setReplayIndex(0);
    setReplayPlaying(false);
    showToast(`Replay frames: ${frames.length}`);
  }, [showToast]);

  const exportAnalytics = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      analytics: computeAnalytics(brushRef.current),
      mathHistory,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aircanvas-analytics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [mathHistory]);

  const handleOCR = useCallback(async () => {
    const draw = drawRef.current;
    if (!draw) return;
    const total = countStrokes(brushRef.current);
    if (total === 0) {
      showToast('Draw or write something first');
      return;
    }
    try {
      const img = exportToCanvas(brushRef.current, draw.width, draw.height);
      const result = await ocrRecognize(img);
      setOcrText(result.text || '(no text detected)');
      showToast(`OCR done — ${Math.round(result.confidence)}% confidence`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCR failed';
      setOcrText(null);
      showToast(message);
    }
  }, [ocrRecognize, showToast]);

  const resetView = useCallback(() => {
    const reset = { scale: 1, offsetX: 0, offsetY: 0 };
    viewTransformRef.current = reset;
    secondHandPrevRef.current = null;
    setViewTransform(reset);
  }, []);

  const handlePrevPage = useCallback(() => {
    const s = brushRef.current;
    if (s.currentPage > 0) {
      brushRef.current = goToPage(s, s.currentPage - 1);
      setDrawVersion((v) => v + 1);
      showToast(`Page ${s.currentPage}`);
    }
  }, [showToast]);

  const handleNextPage = useCallback(() => {
    const s = brushRef.current;
    if (s.currentPage < s.pages.length - 1) {
      brushRef.current = goToPage(s, s.currentPage + 1);
      setDrawVersion((v) => v + 1);
      showToast(`Page ${s.currentPage + 2}`);
    }
  }, [showToast]);

  const handleAddPage = useCallback(() => {
    brushRef.current = addPage(brushRef.current);
    setDrawVersion((v) => v + 1);
    showToast(`Added page ${brushRef.current.pages.length}`);
  }, [showToast]);

  const handleDeletePage = useCallback(() => {
    const s = brushRef.current;
    if (s.pages.length <= 1) return;
    brushRef.current = deletePage(s, s.currentPage);
    setDrawVersion((v) => v + 1);
    showToast(`Deleted page, now on page ${brushRef.current.currentPage + 1}`);
  }, [showToast]);

  useKeyboardShortcuts({
    onUndo: doUndo,
    onRedo: doRedo,
    onClear: () => {
      brushRef.current = clearAll(brushRef.current);
      setDrawVersion((v) => v + 1);
      showToast('Canvas cleared');
    },
    onSaveSession: () => saveCurrentSession('Shortcut Session', ''),
    onToggleMode: () => setMode((m) => (m === 'draw' ? 'math' : 'draw')),
    onPrevPage: handlePrevPage,
    onNextPage: handleNextPage,
    onAddPage: handleAddPage,
  });

  useEffect(() => {
    if (!replayPlaying || replayFrames.length === 0) return;
    replayTimerRef.current = window.setInterval(() => {
      setReplayIndex((i) => (i + 1) % replayFrames.length);
    }, 220);
    return () => {
      if (replayTimerRef.current) window.clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    };
  }, [replayFrames.length, replayPlaying]);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const draw = drawRef.current;
    const debug = debugRef.current;
    const cvMask = cvMaskRef.current;
    const cvEdge = cvEdgeRef.current;
    const lm = landmarkerRef.current;
    if (!video || !draw || !debug || !cvMask || !cvEdge || !lm) return;

    const drawCtx = draw.getContext('2d');
    const debugCtx = debug.getContext('2d');
    const edgeCtx = cvEdge.getContext('2d');
    if (!drawCtx || !debugCtx || !edgeCtx) return;

    const s = controlsRef.current;
    fpsTick();

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const result = lm.detectForVideo(video, performance.now());
      const allHands = result.landmarks ?? [];
      const first = (allHands[0] ?? []) as Array<{ x: number; y: number; z?: number }>;
      const second = (allHands[1] ?? []) as Array<{ x: number; y: number; z?: number }>;

      // ── Second hand: viewport zoom/pan ──
      if (second.length > INDEX_TIP) {
        const mirrored = s.mirror ? second.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z })) : second;
        const { gesture: secGesture } = classifySecondHand(mirrored);
        if (secGesture === 'PINCH') {
          const thumb = mirrored[THUMB_TIP];
          const index = mirrored[INDEX_TIP];
          const pd = dist(thumb, index);
          const mx = (thumb.x + index.x) / 2;
          const my = (thumb.y + index.y) / 2;
          if (secondHandPrevRef.current) {
            const prev = secondHandPrevRef.current;
            const dScale = pd / Math.max(prev.pinchDist, 0.001);
            const dX = (mx - prev.midX) * 400;
            const dY = (my - prev.midY) * 400;
            const vt = viewTransformRef.current;
            const newScale = Math.max(0.5, Math.min(4, vt.scale * dScale));
            const newOffsetX = Math.max(-500, Math.min(500, vt.offsetX + dX));
            const newOffsetY = Math.max(-500, Math.min(500, vt.offsetY + dY));
            const updated = { scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY };
            viewTransformRef.current = updated;
            setViewTransform(updated);
          }
          secondHandPrevRef.current = { pinchDist: pd, midX: mx, midY: my };
          secondHandActiveRef.current = true;
        } else {
          secondHandPrevRef.current = null;
          secondHandActiveRef.current = false;
        }
      } else {
        secondHandPrevRef.current = null;
        secondHandActiveRef.current = false;
      }

      if (s.showDebug && first.length > INDEX_TIP) {
        const lms = s.mirror ? first.map((p) => ({ x: 1 - p.x, y: p.y })) : first.map((p) => ({ x: p.x, y: p.y }));
        renderDebug(debugCtx, lms);
      } else {
        debugCtx.clearRect(0, 0, debug.width, debug.height);
      }

      cvFrameCounterRef.current += 1;
      if (s.showCVMask && isCVReady() && cvFrameCounterRef.current % 3 === 0) {
        try {
          detectSkin(video, cvMask);
        } catch {
          // ignore
        }
      } else if (!s.showCVMask) {
        const maskCtx = cvMask.getContext('2d');
        maskCtx?.clearRect(0, 0, cvMask.width, cvMask.height);
      }

      if (s.showCVEdges && isCVReady() && cvFrameCounterRef.current % 5 === 0) {
        const exp = exportToCanvas(brushRef.current, draw.width, draw.height);
        const edges = cannyEdges(exp);
        edgeCtx.clearRect(0, 0, cvEdge.width, cvEdge.height);
        edgeCtx.globalAlpha = 0.9;
        edgeCtx.drawImage(edges, 0, 0);
      } else if (!s.showCVEdges) {
        edgeCtx.clearRect(0, 0, cvEdge.width, cvEdge.height);
      }

      if (first.length > INDEX_TIP) {
        const idx = first[INDEX_TIP];
        const raw: Point = { x: s.mirror ? 1 - idx.x : idx.x, y: idx.y, z: idx.z };
        const remapped = remapToDrawZone(raw, s.precisionMode);
        if (!filterRef.current) {
          filterRef.current = new OneEuroFilter(
            remapped,
            s.precisionMode ? 1.6 : 2.2,
            s.precisionMode ? 0.035 : 0.05,
          );
        }
        const filtered = filterRef.current.filter(remapped, performance.now() / 1000);
        const stabilized = stabilizePointer(filtered, s.precisionMode);
        const speed = prevCursorRef.current ? estimateSpeed(prevCursorRef.current, stabilized) : 0;
        prevCursorRef.current = cursorRef.current;
        cursorRef.current = stabilized;

        const pressure = zToPressure(idx.z);
        const dynamicSize = pressureSize(s.brushSize, pressure, s.pressureSensitivity);
        const mlm = s.mirror ? first.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z })) : first;
        const { gesture, confidence } = gestureProcRef.current.update(mlm);
        const drawLatched = updatePinchLatch(pinchRatio(mlm), s.precisionMode);
        const resolvedGesture: GestureType = drawLatched ? 'PINCH' : gesture;
        setGestureActive(resolvedGesture);
        setGestureConf(confidence);
        const now = performance.now();
        const strokePoint = { ...stabilized, pressure, speed };
        const updateHoldTracker = (gestureType: GestureType): number => {
          if (holdGestureRef.current !== gestureType) {
            holdGestureRef.current = gestureType;
            triggerHoldStartRef.current = now;
            actionTriggeredRef.current = false;
          } else if (!triggerHoldStartRef.current) {
            triggerHoldStartRef.current = now;
          }
          return now - (triggerHoldStartRef.current ?? now);
        };

        if (resolvedGesture === 'PINCH') {
          holdGestureRef.current = 'NONE';
          triggerHoldStartRef.current = null;
          actionTriggeredRef.current = false;
          isErasingRef.current = false;
          if (!isDrawingRef.current) {
            brushRef.current = startStroke(
              brushRef.current,
              s.brushColor,
              dynamicSize,
              s.brushType,
              strokePoint,
              false,
              s.symmetryMode,
            );
            isDrawingRef.current = true;
            setStatus(mode === 'math' ? 'Writing expression…' : 'Drawing…');
          } else {
            brushRef.current = addPoint(brushRef.current, strokePoint, s.precisionMode ? 0.0034 : 0.0052);
          }
          setStatusType('active');
        } else if (resolvedGesture === 'VICTORY') {
          if (isDrawingRef.current) {
            brushRef.current = endStroke(brushRef.current, s.beautifyShapes ? beautifyStroke : undefined);
            isDrawingRef.current = false;
            setDrawVersion((v) => v + 1);
          }
          holdGestureRef.current = 'NONE';
          triggerHoldStartRef.current = null;
          actionTriggeredRef.current = false;
          if (!isErasingRef.current) {
            brushRef.current = startStroke(brushRef.current, '#000000', dynamicSize * 2.4, 'ink', strokePoint, true);
            isErasingRef.current = true;
          } else {
            brushRef.current = addPoint(brushRef.current, strokePoint, s.precisionMode ? 0.0045 : 0.006);
          }
          setStatus('Erasing (2 fingers)…');
          setStatusType('active');
        } else if (resolvedGesture === 'ROCK') {
          endDrawOrErase();
          const held = updateHoldTracker('ROCK');
          if (held >= ROCK_ANALYZE_HOLD_MS && !actionTriggeredRef.current) {
            actionTriggeredRef.current = true;
            triggerHoldStartRef.current = null;
            void handleAiAnalyze('describe');
          }
          setStatus(`Hold 3 fingers for AI analysis… ${Math.min(100, Math.round((held / ROCK_ANALYZE_HOLD_MS) * 100))}%`);
          setStatusType('idle');
        } else if (resolvedGesture === 'FIST') {
          endDrawOrErase();
          if (mode === 'math') {
            const held = updateHoldTracker('FIST');
            if (held >= FIST_SOLVE_HOLD_MS && !actionTriggeredRef.current) {
              actionTriggeredRef.current = true;
              triggerHoldStartRef.current = null;
              void handleMathSolve();
            }
            setStatus(`Hold fist to solve math… ${Math.min(100, Math.round((held / FIST_SOLVE_HOLD_MS) * 100))}%`);
            setStatusType('active');
          } else {
            holdGestureRef.current = 'NONE';
            triggerHoldStartRef.current = null;
            actionTriggeredRef.current = false;
            setStatus('Paused');
            setStatusType('idle');
          }
        } else {
          endDrawOrErase();
          holdGestureRef.current = 'NONE';
          triggerHoldStartRef.current = null;
          actionTriggeredRef.current = false;
          setStatus(resolvedGesture === 'OPEN' ? 'Open hand: neutral' : 'Ready');
          setStatusType('idle');
        }

        renderDrawing(drawCtx, brushRef.current);
        const cursorMode = resolvedGesture === 'PINCH' ? 'draw' : resolvedGesture === 'VICTORY' ? 'erase' : 'hover';
        renderCursor(drawCtx, stabilized, cursorMode, 7);
      } else {
        endDrawOrErase();
        gestureProcRef.current.reset();
        cursorRef.current = null;
        prevCursorRef.current = null;
        filterRef.current = null;
        stablePointRef.current = null;
        trailRef.current = [];
        holdGestureRef.current = 'NONE';
        triggerHoldStartRef.current = null;
        actionTriggeredRef.current = false;
        pinchLatchedRef.current = false;
        pinchOnFramesRef.current = 0;
        pinchOffFramesRef.current = 0;
        setGestureActive('NONE');
        setStatus('No hand detected');
        setStatusType('idle');
        renderDrawing(drawCtx, brushRef.current);
      }
    } else {
      renderDrawing(drawCtx, brushRef.current);
      if (cursorRef.current) {
        const g = gestureProcRef.current.getGesture();
        renderCursor(drawCtx, cursorRef.current, g === 'PINCH' ? 'draw' : g === 'VICTORY' ? 'erase' : 'hover', 7);
      }
    }

    setTotalStrokes(countStrokes(brushRef.current));
    rafRef.current = requestAnimationFrame(loop);
  }, [doUndo, endDrawOrErase, fpsTick, handleAiAnalyze, handleMathSolve, mode]);

  useEffect(() => {
    if (!cameraOn) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [cameraOn, loop]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (replayTimerRef.current) window.clearInterval(replayTimerRef.current);
      if (mathResultTimerRef.current) window.clearTimeout(mathResultTimerRef.current);
    };
  }, []);

  const gestureMeta = GESTURE_META[gestureActive];
  const videoStyle = useMemo<CSSProperties>(() => ({
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: controls.mirror ? 'scaleX(-1)' : 'none',
    display: controls.showVideo ? 'block' : 'none',
    position: 'absolute',
    inset: 0,
  }), [controls.mirror, controls.showVideo]);

  return (
    <div className="app-root">
      <div className="mode-bar-wrapper">
        <ModeBar
          mode={mode}
          onMode={setMode}
          cameraOn={cameraOn}
          onToggleCamera={() => void toggleCamera()}
          status={status}
          statusType={statusType}
          cvStatus={cvStatus}
          onLoadCV={() => void loadCV()}
          zoomLevel={viewTransform.scale}
          onResetView={resetView}
          currentPage={brushRef.current.currentPage}
          totalPages={getPageCount(brushRef.current)}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
        />
      </div>

      <div className="panel-wrapper">
        <Controls
          mode={mode}
          state={controls}
          onChange={setControls}
          cameraOn={cameraOn}
          gestureActive={gestureActive}
          gestureConfidence={gestureConf}
          fps={fps}
          totalStrokes={totalStrokes}
          analytics={analytics}
          mathHistory={mathHistory}
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          replayFrames={replayFrames}
          replayIndex={replayIndex}
          replayPlaying={replayPlaying}
          ocrStatus={ocrStatus}
          ocrText={ocrText}
          currentPage={brushRef.current.currentPage}
          totalPages={getPageCount(brushRef.current)}
          onUndo={doUndo}
          onRedo={doRedo}
          onClear={() => {
            brushRef.current = clearAll(brushRef.current);
            setDrawVersion((v) => v + 1);
            showToast('Canvas cleared');
          }}
          onExport={handleExport}
          onToggleLayer={(id) => {
            brushRef.current = toggleLayerVisibility(brushRef.current, id);
            setControls((prev) => ({ ...prev, layerVisibility: { ...prev.layerVisibility, [id]: !prev.layerVisibility[id] } }));
            setDrawVersion((v) => v + 1);
          }}
          onAiAnalyze={(analysisMode) => void handleAiAnalyze(analysisMode)}
          onMathSolve={() => void handleMathSolve()}
          onOCR={() => void handleOCR()}
          onAddPage={handleAddPage}
          onDeletePage={handleDeletePage}
          onSaveSession={saveCurrentSession}
          onLoadSession={loadSavedSession}
          onDeleteSession={deleteSavedSession}
          onBuildReplay={buildReplay}
          onReplayIndex={setReplayIndex}
          onToggleReplay={() => setReplayPlaying((v) => !v)}
          onExportAnalytics={exportAnalytics}
        />
      </div>

      <div className="stage-wrapper canvas-stage" style={{ overflow: 'hidden' }}>
        <div style={{
          transform: `translate(${viewTransform.offsetX}px, ${viewTransform.offsetY}px) scale(${viewTransform.scale})`,
          transformOrigin: 'center center',
          position: 'absolute',
          inset: 0,
          transition: secondHandActiveRef.current ? 'none' : 'transform 200ms ease-out',
        }}>
          <video ref={videoRef} playsInline muted style={videoStyle} className="canvas-video" />
          <canvas ref={templateRef} className="canvas-overlay" style={{ zIndex: 1.5, pointerEvents: 'none' }} />
          <canvas ref={drawRef} className="canvas-overlay" style={{ zIndex: 2 }} />
          <canvas ref={debugRef} className="canvas-overlay" style={{ zIndex: 3, display: controls.showDebug ? 'block' : 'none', mixBlendMode: 'screen' }} />
          <canvas ref={cvMaskRef} className="cv-overlay-canvas" style={{ zIndex: 4, display: controls.showCVMask ? 'block' : 'none' }} />
          <canvas ref={cvEdgeRef} className="cv-overlay-canvas" style={{ zIndex: 5, display: controls.showCVEdges ? 'block' : 'none' }} />
        </div>

        {!cameraOn && (
          <div className="canvas-start-prompt" style={{ zIndex: 10 }}>
            <div className="start-icon">🖐️</div>
            <div className="start-title">AirCanvas Final Studio</div>
            <div className="start-sub">
              Real-time hand-air drawing, OpenCV overlays, OpenAI math solving, and Gemini canvas analysis.
            </div>
            <button className="mode-bar-cam-btn" style={{ marginTop: 4, width: 200 }} onClick={() => void toggleCamera()}>
              📷 Start Camera
            </button>
          </div>
        )}

        {gestureActive !== 'NONE' && cameraOn && (
          <div className="gesture-hud">
            <div className="gesture-badge" style={{ borderColor: gestureMeta.color, boxShadow: `0 0 18px ${gestureMeta.color}44` }}>
              <span className="gesture-badge-emoji">{gestureMeta.emoji}</span>
              <span style={{ color: gestureMeta.color }}>{gestureMeta.label}</span>
            </div>
          </div>
        )}

        {latestMathResult && mode === 'math' && (
          <div className={`math-result-pop ${showMathResultPop ? 'show' : ''}`} style={{ zIndex: 12 }}>
            <div className="math-result-header">
              <span>Math Solved</span>
              <span className="math-provider-chip openai">AI</span>
            </div>
            <div className="math-result-expression">{latestMathResult.expression}</div>
            <div className="math-result-answer">= {latestMathResult.answer}</div>
            <div className="math-result-meta">
              <span>{Math.round(latestMathResult.confidence * 100)}% confidence</span>
              <span>{latestMathResult.latencyMs}ms</span>
            </div>
          </div>
        )}

        {replayFrames.length > 0 && (
          <img
            src={replayFrames[replayIndex]}
            alt="Replay frame"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 6, pointerEvents: 'none', opacity: replayPlaying ? 0.9 : 0.65 }}
          />
        )}

        {viewTransform.scale !== 1 && (
          <div className="zoom-info">
            🔍 {Math.round(viewTransform.scale * 100)}%
          </div>
        )}

        {cameraOn && (
          <div className="stats-hud">
            <div className="stat-row"><span>FPS</span><span className="stat-val">{fps}</span></div>
            <div className="stat-row"><span>Gesture</span><span className="stat-val">{gestureActive}</span></div>
            <div className="stat-row"><span>Conf</span><span className="stat-val">{Math.round(gestureConf * 100)}%</span></div>
            <div className="stat-row"><span>Mode</span><span className="stat-val">{mode}</span></div>
          </div>
        )}

        <div className="toast-container">
          {toasts.map((t) => <div key={t.id} className="toast">{t.message}</div>)}
        </div>
      </div>

      {showAiModal && (
        <AIModal
          title={aiModalTitle}
          loading={aiLoading}
          result={aiResult}
          error={aiError}
          onClose={() => setShowAiModal(false)}
        />
      )}
    </div>
  );
}
