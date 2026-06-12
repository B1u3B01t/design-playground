/** Preferred local worker path (used by test-playground when present). */
const PDF_WORKER_LOCAL_SRC = '/pdf.worker.min.mjs';

/** Minimum supersampling factor for canvas render (on top of devicePixelRatio). */
export const PDF_RENDER_SUPERSAMPLE = 3;

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
let workerSrcPromise: Promise<string> | null = null;

async function canLoadWorker(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function resolvePdfWorkerSrc(pdfjs: typeof import('pdfjs-dist')): Promise<string> {
  if (!workerSrcPromise) {
    workerSrcPromise = (async () => {
      // 1) Keep compatibility with test-playground/public worker setup.
      if (await canLoadWorker(PDF_WORKER_LOCAL_SRC)) {
        return PDF_WORKER_LOCAL_SRC;
      }

      // 2) Fallback to a version-matched CDN worker if local file is missing.
      const version = pdfjs.version || 'latest';
      const cdn = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
      if (await canLoadWorker(cdn)) {
        return cdn;
      }

      // 3) Last resort: return the expected local path (keeps behavior deterministic).
      return PDF_WORKER_LOCAL_SRC;
    })();
  }
  return workerSrcPromise;
}

export async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then(async (pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = await resolvePdfWorkerSrc(pdfjs);
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
