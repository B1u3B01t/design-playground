"use client";

// Node-anchored comments, rendered as a screen-space overlay so no node component needs to
// change. A pin shows on every node that has threads (plus a "+" pin on the selected node to
// start the first comment). Clicking a pin opens a popover with the node's threads (Liveblocks
// <Thread> — replies + resolve built in) and a <Composer> that creates a new thread anchored to
// the node via metadata. Mount as a direct child of <ReactFlow> (screen space, not transformed).

import { useState } from "react";
import { useThreads } from "@liveblocks/react";
import { Composer, Thread } from "@liveblocks/react-ui";
import "@liveblocks/react-ui/styles.css";
import { useViewport } from "@xyflow/react";
import { useCanvasFlow } from "./canvas-flow";

export function CommentsLayer() {
  const { threads } = useThreads();
  const { nodes } = useCanvasFlow();
  const viewport = useViewport();
  const [openNodeId, setOpenNodeId] = useState<string | null>(null);

  const anchored = (threads ?? []).filter((t) => !!t.metadata.nodeId);
  const threadsByNode: Record<string, typeof anchored> = {};
  for (const t of anchored) {
    (threadsByNode[t.metadata.nodeId as string] ??= []).push(t);
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const selectedNodeId = nodes.find((n) => n.selected)?.id;

  const pinNodeIds = new Set<string>(Object.keys(threadsByNode));
  if (selectedNodeId) pinNodeIds.add(selectedNodeId);
  if (pinNodeIds.size === 0) return null;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6 }}>
      {[...pinNodeIds].map((nodeId) => {
        const n = nodeById.get(nodeId);
        if (!n) return null;
        const nodeThreads = threadsByNode[nodeId] ?? [];
        const count = nodeThreads.length;
        const w = n.measured?.width ?? (typeof n.width === "number" ? n.width : 0);
        const x = (n.position.x + w) * viewport.zoom + viewport.x;
        const y = n.position.y * viewport.zoom + viewport.y;
        const isOpen = openNodeId === nodeId;
        const data = n.data as Record<string, unknown> | undefined;
        const filename = typeof data?.filename === "string" ? data.filename : undefined;

        return (
          <div
            key={nodeId}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: "translate(-40%, -60%)",
              pointerEvents: "auto",
            }}
          >
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setOpenNodeId(isOpen ? null : nodeId)}
              title={count > 0 ? `${count} comment${count > 1 ? "s" : ""}` : "Add comment"}
              className="flex items-center gap-1 rounded-full bg-white text-stone-700 shadow-[0_2px_8px_rgba(0,0,0,0.14)] border border-stone-200 hover:bg-stone-50 transition-colors"
              style={{
                height: 24,
                padding: count > 0 ? "0 7px 0 6px" : 0,
                width: count > 0 ? undefined : 24,
                justifyContent: "center",
                borderStyle: count > 0 ? "solid" : "dashed",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              {count > 0 && <span className="text-[11px] font-semibold leading-none">{count}</span>}
            </button>

            {isOpen && (
              <div
                style={{
                  position: "absolute",
                  top: 28,
                  left: 0,
                  width: 320,
                  maxHeight: 440,
                  overflowY: "auto",
                  background: "white",
                  border: "1px solid #e7e5e4",
                  borderRadius: 12,
                  boxShadow: "0 10px 34px rgba(0,0,0,0.14)",
                }}
                onWheel={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-2.5 py-2 border-b border-stone-100">
                  <span className="text-[11px] font-semibold text-stone-500">Comments</span>
                  <button
                    type="button"
                    onClick={() => setOpenNodeId(null)}
                    aria-label="Close"
                    className="flex items-center justify-center w-5 h-5 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {nodeThreads.map((t) => (
                  <Thread key={t.id} thread={t} className="border-b border-stone-100" />
                ))}
                <Composer metadata={filename ? { nodeId, filename } : { nodeId }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
