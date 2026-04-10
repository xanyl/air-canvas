/**
 * skinDetect.ts — Real-time HSV skin colour segmentation using OpenCV.js
 *
 * Algorithm:
 *  1. Convert BGR frame to HSV colour space
 *  2. Threshold two HSV ranges that cover most skin tones
 *  3. Morphological operations to clean up noise
 *  4. Output a binary mask canvas
 *
 * Used in AirCanvas 3D Studio as a debug overlay to visualise where
 * OpenCV detects the hand region independently of MediaPipe.
 */

import { getCV } from './opencvLoader';

// HSV ranges that approximate human skin tones under typical lighting
const SKIN_LOWER1 = [0,   20, 70];
const SKIN_UPPER1 = [20, 255, 255];
const SKIN_LOWER2 = [170, 20, 70];
const SKIN_UPPER2 = [180,255,255];

export interface SkinDetectResult {
  /** Detected area fraction (0-1). 0 = no skin detected. */
  skinFraction: number;
  /** Bounding rect of largest contour */
  bbox: { x: number; y: number; w: number; h: number } | null;
}

let _kernelMorph: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Run skin detection on a video frame and draw the mask to an output canvas.
 *
 * @param video       Source video element
 * @param outCanvas   Canvas to write the coloured mask to (same size as video)
 * @returns           Detection result
 */
export function detectSkin(
  video: HTMLVideoElement,
  outCanvas: HTMLCanvasElement
): SkinDetectResult {
  const cv = getCV();
  const w = video.videoWidth  || 640;
  const h = video.videoHeight || 360;

  outCanvas.width  = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;

  // Draw the video frame into a temp canvas to get pixel data
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = w; tmpCanvas.height = h;
  const tmpCtx = tmpCanvas.getContext('2d')!;
  tmpCtx.drawImage(video, 0, 0, w, h);

  let src: any, hsv: any, mask1: any, mask2: any, mask: any, cleaned: any;

  try {
    src  = cv.imread(tmpCanvas);
    hsv  = new cv.Mat();
    mask1 = new cv.Mat();
    mask2 = new cv.Mat();
    mask  = new cv.Mat();
    cleaned = new cv.Mat();

    cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
    cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

    const lo1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), SKIN_LOWER1.concat([0]));
    const hi1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), SKIN_UPPER1.concat([255]));
    const lo2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), SKIN_LOWER2.concat([0]));
    const hi2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), SKIN_UPPER2.concat([255]));

    // Better: use inRange with scalar bounds
    cv.inRange(hsv, new cv.Mat(1, 1, cv.CV_8UC3, SKIN_LOWER1), new cv.Mat(1, 1, cv.CV_8UC3, SKIN_UPPER1), mask1);
    cv.inRange(hsv, new cv.Mat(1, 1, cv.CV_8UC3, SKIN_LOWER2), new cv.Mat(1, 1, cv.CV_8UC3, SKIN_UPPER2), mask2);

    lo1.delete(); hi1.delete(); lo2.delete(); hi2.delete();

    cv.add(mask1, mask2, mask);

    // Morphological cleanup
    if (!_kernelMorph) {
      _kernelMorph = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(7, 7));
    }
    cv.morphologyEx(mask, cleaned, cv.MORPH_OPEN,  _kernelMorph);
    cv.morphologyEx(cleaned, cleaned, cv.MORPH_DILATE, _kernelMorph);

    // Find contours for bbox
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(cleaned, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let bbox: SkinDetectResult['bbox'] = null;
    let maxArea = 0;

    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const area = cv.contourArea(c);
      if (area > maxArea) {
        maxArea = area;
        const r = cv.boundingRect(c);
        bbox = { x: r.x, y: r.y, w: r.width, h: r.height };
      }
    }

    contours.delete(); hierarchy.delete();

    // Coloured mask: skin pixels → cyan
    const coloured = new cv.Mat();
    cv.cvtColor(cleaned, coloured, cv.COLOR_GRAY2RGBA);

    // Tint cyan: R=0, G=229, B=255
    for (let i = 0; i < coloured.data.length; i += 4) {
      if (coloured.data[i + 3] > 0) {
        coloured.data[i]     = 0;
        coloured.data[i + 1] = 200;
        coloured.data[i + 2] = 255;
        coloured.data[i + 3] = 180;
      }
    }

    cv.imshow(outCanvas, coloured);
    coloured.delete();

    // Also redraw through putImageData to ensure visible on canvas
    const skinFraction = (cv.countNonZero(cleaned)) / (w * h);

    return { skinFraction, bbox };

  } catch (e) {
    outCtx.clearRect(0, 0, w, h);
    return { skinFraction: 0, bbox: null };
  } finally {
    src?.delete(); hsv?.delete();
    mask1?.delete(); mask2?.delete();
    mask?.delete(); cleaned?.delete();
  }
}

/**
 * Draw a bounding box overlay for the detected hand region.
 */
export function drawSkinBbox(
  ctx: CanvasRenderingContext2D,
  bbox: SkinDetectResult['bbox']
) {
  if (!bbox) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(0,229,255,0.7)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
  ctx.setLineDash([]);
  ctx.restore();
}
