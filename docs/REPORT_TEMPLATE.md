# Course Report Template (Masters CV Project)

## 1. Problem Statement
- What problem does air-writing solve?
- Why gesture-based interaction is relevant for CV/HCI.

## 2. Objectives
- Real-time hand tracking and gesture interpretation.
- Robust drawing/erasing interaction in live video.
- AI-assisted interpretation (description + math solving).

## 3. Methodology
### 3.1 Hand Tracking
- MediaPipe Hand Landmarker configuration.
- Landmark selection and normalization.

### 3.2 Gesture Recognition
- Gesture definitions (`POINT`, `PINCH`, `VICTORY`, `ROCK`, `FIST`, `OPEN`).
- Temporal debounce with confirmation frames.

### 3.3 Drawing Engine
- Layered stroke representation.
- Brush rendering algorithms.
- Symmetry and shape beautification strategy.

### 3.4 OpenCV Enhancements
- HSV skin masking.
- Edge extraction (Canny) and visualization.

### 3.5 AI Integration
- Backend proxy design and security rationale.
- Prompt design for analysis and math extraction.
- Response normalization and error handling.

## 4. Experiments and Evaluation
- Device/browser setup.
- FPS and latency measurements.
- Gesture accuracy observations.
- Math solve examples and failure cases.

## 5. Results
- Qualitative demo outcomes.
- Quantitative metrics table (FPS, response times, solve success).

## 6. Limitations
- Lighting/background sensitivity.
- Handwriting ambiguity for arithmetic parsing.
- Browser/OpenCV performance variability.

## 7. Future Work
- Multi-hand cooperative gestures.
- Local OCR fallback for offline mode.
- Model-assisted stroke correction and tutoring feedback.

## 8. Conclusion
- Summary of contributions and learning outcomes.
