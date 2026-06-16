import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PREVIEW_COLOR_SCHEME_STORAGE_KEY } from './constants';

/**
 * Per-canvas color-scheme override for component previews.
 *
 *  - 'auto'  : mirror the host app. Previews inherit the host's own tokens, so
 *              if the host toggles its `.dark` class the previews follow
 *              automatically. The playground chrome is unaffected — it reads the
 *              private `--pg-*` namespace, which has no dark variant. No class
 *              is applied.
 *  - 'dark'  : force previews dark by adding `.dark` to the canvas root, so the
 *              host's own `.dark { ... }` token overrides apply to every preview
 *              regardless of the host's current mode. Guaranteed.
 *  - 'light' : best-effort force-light (adds `.light`). Reliable when the host
 *              is already light; when the host sets `.dark` on an ancestor it
 *              cannot be fully undone in pure CSS — 'auto' and 'dark' are the
 *              guaranteed paths.
 */
export type PreviewColorScheme = 'auto' | 'light' | 'dark';

interface PreviewColorSchemeState {
  scheme: PreviewColorScheme;
  setScheme: (scheme: PreviewColorScheme) => void;
  cycle: () => void;
}

/** Cycle order for the header toggle. */
const ORDER: PreviewColorScheme[] = ['auto', 'dark', 'light'];

export const usePreviewColorSchemeStore = create<PreviewColorSchemeState>()(
  persist(
    (set) => ({
      scheme: 'auto',
      setScheme: (scheme: PreviewColorScheme) => set({ scheme }),
      cycle: () =>
        set((state) => ({
          scheme: ORDER[(ORDER.indexOf(state.scheme) + 1) % ORDER.length],
        })),
    }),
    {
      name: PREVIEW_COLOR_SCHEME_STORAGE_KEY,
    }
  )
);

/**
 * Class to add to the preview root (canvas `.playground-main-view`, or the
 * standalone `.app-theme` iteration view) for the active override. Empty string
 * for 'auto' (mirror the host).
 */
export function previewSchemeClass(scheme: PreviewColorScheme): string {
  return scheme === 'dark' ? 'dark' : scheme === 'light' ? 'light' : '';
}
