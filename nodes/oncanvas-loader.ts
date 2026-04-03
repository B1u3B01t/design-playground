// Centralized loader for on-canvas JSX components.
// Uses a relative path so the playground can be embedded into
// other Next.js applications without relying on host-specific aliases.

export async function loadOnCanvasComponentModule() {
  return import('../canvas-components');
}

