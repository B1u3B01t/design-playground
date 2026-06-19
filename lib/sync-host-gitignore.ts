/**
 * Non-throwing wrapper around host-gitignore.mjs for Next.js API routes.
 * Gitignore sync must never break generation or file operations.
 */

export function syncPublicFrameGitignoreSafe(root: string = process.cwd()): void {
  void import('./host-gitignore.mjs')
    .then((mod) => {
      mod.syncPublicFrameGitignore(root);
    })
    .catch(() => {
      /* gitignore sync is best-effort */
    });
}
