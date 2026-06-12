export function getFlowPreviewUrl(
  flowId: string,
  options?: { useCanonical?: boolean },
): string {
  const params = new URLSearchParams({ flowId });
  if (options?.useCanonical) params.set('combine', '1');
  return `/playground/flow?${params.toString()}`;
}
