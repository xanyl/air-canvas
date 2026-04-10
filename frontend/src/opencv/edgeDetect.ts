/**
 * edgeDetect.ts — Canny edge detection applied to the 2D drawing canvas.
 *
 * Used to generate an "edge art" version of the current drawing
 * which is sent alongside the base image in the AI analysis request.
 */

import { getCV } from './opencvLoader';

/**
 * Apply Canny edge detection to a canvas and return a new canvas with edges.
 * @param sourceCanvas  The 2D drawing canvas
 * @param lowThreshold  Canny low threshold (default 50)
 * @param highThreshold Canny high threshold (default 150)
 */
export function cannyEdges(
  sourceCanvas: HTMLCanvasElement,
  lowThreshold  = 50,
  highThreshold = 150
): HTMLCanvasElement {
  const cv = getCV();
  const out = document.createElement('canvas');
  out.width  = sourceCanvas.width;
  out.height = sourceCanvas.height;

  let src: any, gray: any, edges: any;
  try {
    src   = cv.imread(sourceCanvas);
    gray  = new cv.Mat();
    edges = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.Canny(gray, edges, lowThreshold, highThreshold);

    // Colour edges cyan
    const coloured = new cv.Mat();
    cv.cvtColor(edges, coloured, cv.COLOR_GRAY2RGBA);
    for (let i = 0; i < coloured.data.length; i += 4) {
      if (coloured.data[i] > 0) {
        coloured.data[i]     = 0;
        coloured.data[i + 1] = 200;
        coloured.data[i + 2] = 255;
      }
    }

    cv.imshow(out, coloured);
    coloured.delete();
  } catch {
    // silently fail
  } finally {
    src?.delete(); gray?.delete(); edges?.delete();
  }

  return out;
}
