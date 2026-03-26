/**
 * Prompt for adopting an HTML iteration as the main page.
 */

export function htmlAdoptPrompt(pageFolder: string, iterationFolder: string): string {
  return `Copy public/${pageFolder}/${iterationFolder}/index.html to public/${pageFolder}/index.html.
Asset references using absolute paths (/${pageFolder}/...) should remain unchanged.
If the iteration has local copies of assets in its folder, those do NOT need to be copied —
the parent folder already has the originals.`;
}
