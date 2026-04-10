# Architecture and Data Flow

```mermaid
flowchart LR
  Camera["Webcam Stream"] --> Frontend["Frontend (React + TS)"]
  Frontend --> MP["MediaPipe Hand Landmarker"]
  Frontend --> Draw["Brush Engine + Renderer"]
  Frontend --> CV["OpenCV.js (skin + edges)"]
  Draw --> Stage["Canvas Stage (video + template + draw + overlays)"]
  Stage --> User["User Feedback HUD"]
  Frontend --> API["FastAPI Backend"]
  API --> Gemini["Gemini API (analysis)"]
  API --> OpenAI["OpenAI API (math solve)"]
  Gemini --> API
  OpenAI --> API
  API --> Frontend
  Frontend --> Session["Session Storage (localStorage)"]
```

## Subsystems

- **CV Pipeline**: webcam frame -> MediaPipe landmarks -> gesture state machine -> drawing commands.
- **Drawing Engine**: layered stroke model with brush effects, symmetry, undo/redo, export.
- **Creative Assist**: template overlays + shape beautify + replay generation.
- **AI Services**: backend proxy where Gemini handles analysis and OpenAI handles math solving (Gemini fallback), with schema normalization and error handling.
- **Persistence**: session records saved in browser localStorage with previews and analytics.

## Runtime Loop

1. Read current webcam frame.
2. Detect landmarks via MediaPipe.
3. Classify gesture with temporal confirmation (`GestureProcessor`).
4. Dispatch action (draw/erase/undo/AI/math trigger).
5. Render layers + cursor.
6. Optionally run OpenCV skin/edge overlays on sampled frames.
7. Update HUD metrics.
