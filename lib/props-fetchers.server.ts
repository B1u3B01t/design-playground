/**
 * Server-side props fetchers for discovered components.
 *
 * Each entry maps a discovery component ID to an async function that fetches
 * real data once — during the "Add to Playground" analysis flow. The result is
 * passed to the Cursor agent as a data snapshot so it can write realistic,
 * live-data-based mock props into the discovered wrapper file.
 *
 * NEVER call these at render time. They are only safe to run in server-side
 * route handlers.
 *
 * Example entry:
 *
 *   'my-component': async () => {
 *     const data = await fetchMyData();
 *     return { items: data };
 *   },
 */

import 'server-only';

type PropsSnapshot = Record<string, unknown>;

const propsFetchers: Record<string, () => Promise<PropsSnapshot>> = {
  // ---------------------------------------------------------------------------
  // Add project-specific fetchers here.
  // Each key should match the component ID used in registry.tsx.
  // ---------------------------------------------------------------------------
};

/**
 * Fetch a real-data snapshot for a given component ID.
 * Returns null if no fetcher is registered for that ID, or if the fetch fails.
 */
export async function fetchPropsSnapshot(componentId: string): Promise<PropsSnapshot | null> {
  const fetcher = propsFetchers[componentId];
  if (!fetcher) return null;
  try {
    return await fetcher();
  } catch (err) {
    console.warn(`[props-fetchers] Snapshot fetch failed for "${componentId}":`, err);
    return null;
  }
}
