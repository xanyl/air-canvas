# AirCanvas Final Project

Master's-level Computer Vision project: real-time air-writing and drawing with hand gestures using **MediaPipe + OpenCV + OpenAI + Gemini + FastAPI + React**.

## Features

- Hand gesture drawing and erasing
  - `POINT`: hover cursor
  - `PINCH`: draw
  - `VICTORY`: erase
  - `FIST (hold in Math mode)`: solve math
  - `FIST` in Draw mode: pause
  - `ROCK (3 fingers hold)`: trigger Gemini analysis
  - `OPEN`: neutral (no AI trigger, prevents accidental activation)
- 7 brushes: ink, neon, watercolor, spray, calligraphy, glitter, chalk
- Layered canvas: background/canvas/overlay with visibility toggle
- Creative tools
  - Symmetry mode (`off`, `horizontal`, `vertical`, `quad`)
  - Template tracing presets (grid, math, portrait, mandala)
  - Smart shape beautify (line/circle/rectangle cleanup)
  - Timelapse replay frame builder + scrubber
- OpenCV overlays
  - HSV skin mask
  - Canny edge overlay
- Hybrid AI services
  - Gemini: drawing analysis (`describe`, `critique`, `style`, `poem`)
  - OpenAI (primary): handwritten arithmetic solving in Math mode
  - Gemini fallback for math if OpenAI is unavailable
- Session gallery
  - Save/load/delete sessions from localStorage
  - Snapshot notes and preview thumbnails
- Analytics export (JSON)
- Keyboard shortcuts
  - `Ctrl/Cmd+Z`: undo
  - `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y`: redo
  - `Ctrl/Cmd+S`: save quick session
  - `C`: clear canvas
  - `M`: toggle draw/math mode

## Project Structure

```text
.
├── frontend/                 # React + Vite + TypeScript UI
│   └── src/
│       ├── cv/               # MediaPipe and gesture logic
│       ├── draw/             # Brush engine, renderer, templates, replay
│       ├── opencv/           # OpenCV lazy loader + skin/edge processing
│       ├── ai/               # Backend API client
│       ├── session/          # Session storage + analytics
│       ├── ui/               # Mode bar, controls, modal components
│       └── hooks/
├── backend/                  # FastAPI AI proxy (OpenAI + Gemini)
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── config.py
│   │   └── gemini.py         # AI service layer (Gemini analyze + OpenAI math)
│   └── tests/
└── docs/                     # Architecture + evaluation + report template
```

## Requirements

- Node.js 18+ (tested with Node 25)
- Python 3.10+ (tested with Python 3.13)
- Webcam-capable browser (Chrome/Edge recommended)

## Setup

1. Install dependencies:

```bash
npm install
npm run setup
```

2. Create environment files:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Edit `.env` / `backend/.env` and set:

```bash
GEMINI_API_KEY=your_real_key
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=your_real_key
OPENAI_MODEL=gpt-4o-mini
FRONTEND_ORIGIN=http://localhost:5173
VITE_API_BASE_URL=http://localhost:8000
```

## Run

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Health check: `http://localhost:8000/api/health`

## Build & Test

```bash
npm run build
npm run test
```

Includes:
- Frontend unit tests (gesture, brush engine, session storage)
- Backend tests (health + schema validation + model JSON parsing utility)

## API Contracts

### `POST /api/ai/analyze`

Request:

```json
{
  "imageBase64": "...",
  "mode": "describe",
  "promptContext": "optional"
}
```

Response:

```json
{
  "text": "...",
  "mode": "describe",
  "model": "gemini-2.5-flash",
  "latencyMs": 742
}
```

### `POST /api/math/solve`

Request:

```json
{
  "imageBase64": "..."
}
```

Response:

```json
{
  "expression": "1+5=",
  "answer": "6",
  "confidence": 0.92,
  "rawModelText": "{\"expression\":\"1+5=\",\"answer\":\"6\",\"confidence\":0.92}",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "latencyMs": 701
}
```

## Demo Flow (for Viva/Presentation)

1. Start camera and show gesture HUD.
2. Draw in `Draw` mode with 2-3 brushes.
3. Toggle symmetry + template tracing.
4. Use victory gesture to erase and fist gesture to pause.
5. Hold 3-finger `ROCK` to trigger Gemini describe, then run `Critique`.
6. Switch to `Math` mode, write `1 + 5 =`, hold `FIST` to solve.
7. Save session with notes, reload from gallery.
8. Build timelapse replay and scrub timeline.
9. Export drawing + analytics JSON.

## Notes

- OpenCV is lazy-loaded in-browser and may take a few seconds first time.
- OpenAI and Gemini keys stay on backend; frontend calls only your local API.
- For deployed builds, use HTTPS for webcam access.
