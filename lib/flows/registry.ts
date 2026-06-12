import type { FlowDescriptor } from './types';
import { signupFlow } from '../../data/flows/signup';

/**
 * Map of flow descriptors keyed by component registry id (e.g. 'signup').
 * Used by ComponentNode/IterationNode to decide whether the Decompose chip
 * should be shown for a given component.
 */
export const flowsByComponentId: Record<string, FlowDescriptor> = {
  signup: signupFlow,
  /** Registry id for the Signup page component on the canvas */
  'signup-page': signupFlow,
};

export function findFlowDescriptorForComponent(
  componentId: string,
): FlowDescriptor | null {
  return flowsByComponentId[componentId] ?? null;
}

export function findFlowDescriptorById(
  descriptorId: string,
): FlowDescriptor | null {
  return (
    Object.values(flowsByComponentId).find((d) => d.id === descriptorId) ??
    null
  );
}
