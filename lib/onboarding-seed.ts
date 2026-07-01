// First-run onboarding: a pre-placed demo scene so brand-new installs can try the
// core loop (drop → iterate → compare) immediately, without waiting for repo
// discovery. See loadCanvasState() in canvas-persistence.ts for where this is seeded.
//
// Everything here renders with zero discovery, zero AI generation and zero backend:
//   • component nodes resolve through the built-in demo registry (examples/welcome/demo-registry.tsx)
//   • the image node uses an inline SVG data URL (nothing to serve)
//   • no edges are used — the canvas doesn't render edges (ReactFlow gets edges={[]});
//     the iterate/compare relationship is conveyed by layout + text labels instead.
// The seeded nodes are ordinary, individually-deletable canvas nodes; after the first
// render they are persisted like any other state, so the scene never re-seeds.

import type { Node } from '@xyflow/react';
import type { CanvasState } from './canvas-persistence';

// Compact "How it works" diagram (Drop → Iterate → Compare), inlined so it needs no
// server route or public asset. Kept small since it lands in localStorage.
const DEMO_IMAGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="190" viewBox="0 0 300 190" fill="none">
<rect width="300" height="190" rx="14" fill="#F8FAFC"/>
<rect x="0.5" y="0.5" width="299" height="189" rx="13.5" stroke="#E2E8F0"/>
<text x="20" y="34" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#0F172A">How it works</text>
<rect x="20" y="56" width="70" height="92" rx="10" fill="#EEF2FF" stroke="#C7D2FE"/>
<circle cx="55" cy="90" r="12" fill="#6366F1"/>
<text x="55" y="95" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#FFFFFF">1</text>
<text x="55" y="128" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#4338CA">Drop</text>
<path d="M92 102 h18" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>
<path d="M106 97 l6 5 -6 5" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="114" y="56" width="70" height="92" rx="10" fill="#F5F3FF" stroke="#DDD6FE"/>
<circle cx="149" cy="90" r="12" fill="#8B5CF6"/>
<text x="149" y="95" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#FFFFFF">2</text>
<text x="149" y="128" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#6D28D9">Iterate</text>
<path d="M186 102 h18" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>
<path d="M200 97 l6 5 -6 5" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="208" y="56" width="70" height="92" rx="10" fill="#FDF4FF" stroke="#F5D0FE"/>
<circle cx="243" cy="90" r="12" fill="#D946EF"/>
<text x="243" y="95" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#FFFFFF">3</text>
<text x="243" y="128" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" font-weight="600" fill="#A21CAF">Compare</text>
</svg>`;

export const DEMO_IMAGE_DATA_URL = `data:image/svg+xml,${encodeURIComponent(DEMO_IMAGE_SVG)}`;

const NOTE_TEXT = `👋 Welcome to Playground

Everything here is a live, editable node — nothing has been discovered from your repo yet.

Try it:
• Select the card on the left, then click Iterate to generate AI variations (like the three below it).
• Drag your own components in from the sidebar once discovery finishes.
• Select any node and hit Delete to clear this demo.`;

function textNode(id: string, x: number, y: number, text: string): Node {
  return { id, type: 'text', position: { x, y }, data: { text, autofocus: false } };
}

function componentNode(id: string, x: number, y: number, componentId: string): Node {
  return { id, type: 'component', position: { x, y }, data: { componentId, size: 'default' } };
}

/**
 * Build the first-run onboarding canvas: the "original" Welcome component, three
 * pre-styled AI-style variations laid out below it with labels, an instruction
 * note, and a "how it works" image. No `viewport` is set on purpose — the canvas
 * falls back to fitView and frames the whole scene automatically.
 */
export function createOnboardingCanvasState(): CanvasState {
  const nodes: Node[] = [
    // Original component (top-left of the cluster)
    componentNode('demo-welcome', 60, 0, 'welcome'),

    // Instruction note (right of the original)
    textNode('demo-note', 540, 20, NOTE_TEXT),

    // "How it works" image (below the note)
    {
      id: 'demo-image',
      type: 'image',
      position: { x: 540, y: 300 },
      width: 300,
      height: 210,
      style: { width: 300, height: 210 },
      data: {
        imagePath: 'demo/playground-welcome.svg',
        imageUrl: DEMO_IMAGE_DATA_URL,
        filename: 'playground-welcome-demo.svg',
        originalName: 'How Playground works',
      },
    },

    // Variation labels + variation components (row below the original)
    textNode('demo-label-1', -412, 516, '✨ Variation 1'),
    textNode('demo-label-2', 68, 516, '✨ Variation 2'),
    textNode('demo-label-3', 548, 516, '✨ Variation 3'),
    componentNode('demo-variation-1', -420, 560, 'welcome-variation-1'),
    componentNode('demo-variation-2', 60, 560, 'welcome-variation-2'),
    componentNode('demo-variation-3', 540, 560, 'welcome-variation-3'),
  ];

  return {
    nodes,
    edges: [],
    nodeIdCounter: 0,
    knownIterations: [],
    collapsedNodeIds: [],
  };
}
