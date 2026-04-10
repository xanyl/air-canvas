# Evaluation Checklist

## 1) FPS Stability

- [ ] Camera on, default settings: FPS >= 24 for 60 seconds
- [ ] With debug + OpenCV mask: FPS remains usable (>= 18)
- [ ] With edge overlay on: no freeze/crash

## 2) Gesture Reliability

- [ ] `PINCH` starts drawing within 300 ms
- [ ] `VICTORY` reliably erases
- [ ] `ROCK (3 fingers hold)` reliably triggers Gemini analysis
- [ ] `FIST` reliably pauses interaction in Draw mode
- [ ] `FIST (hold)` reliably solves expression in Math mode
- [ ] False positives are low in normal lighting

## 3) Drawing Features

- [ ] All 7 brushes render distinct behavior
- [ ] Layer switching/visibility works
- [ ] Symmetry modes produce expected mirror behavior
- [ ] Template presets visible and non-intrusive
- [ ] Shape beautify snaps rough line/circle/rectangle

## 4) Math Solving

- [ ] Solve `1 + 5 =` returns `6`
- [ ] Solve works for `* / -` expressions
- [ ] Unclear handwriting returns graceful message / low confidence
- [ ] Math history is recorded in panel

## 5) AI Description Quality

- [ ] Describe output references visible content
- [ ] Critique gives actionable suggestions
- [ ] Style and poem modes produce coherent text
- [ ] Latency and model metadata returned

## 6) Export & Persistence

- [ ] Export PNG/JPG/SVG works
- [ ] Save session stores preview + notes
- [ ] Reload session restores canvas and math history
- [ ] Delete session removes record cleanly
- [ ] Analytics JSON export contains expected fields

## 7) Replay

- [ ] Replay frame generation completes without errors
- [ ] Play/pause and scrub slider work
- [ ] Overlayed replay frames match drawn progression
