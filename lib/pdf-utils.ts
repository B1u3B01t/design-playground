/** Static worker copied to public/ — avoids Turbopack bundling mismatches. */
const PDF_WORKER_SRC = '/pdf.worker.min.mjs';

/** Minimum supersampling factor for canvas render (on top of devicePixelRatio). */
export const PDF_RENDER_SUPERSAMPLE = 3;

let pdfjsPromise: Promise<typeof import('pdfjs-dist/build/pdf.mjs')> | null = null;

export async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/build/pdf.mjs').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/** Pixel ratio for canvas backing store — maximizes sharpness when CSS-downscaled. */
export function getPdfRenderPixelRatio(): number {
  if (typeof window === 'undefined') return PDF_RENDER_SUPERSAMPLE;
  const dpr = window.devicePixelRatio || 1;
  return Math.max(PDF_RENDER_SUPERSAMPLE, dpr * 2);
}
