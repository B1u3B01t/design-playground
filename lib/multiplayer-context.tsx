"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Multiplayer session flags, available anywhere under PlaygroundClient via useMultiplayer().
 * Avoids threading roomId/isHost/enabled through the 4000-line PlaygroundCanvas as props.
 *
 * - `enabled`: a room is active (Liveblocks providers are mounted above this).
 * - `isHost`: this participant runs the dev server + agent (see isSessionHost in liveblocks.config).
 * - `roomId`: the active room id, or null in single-player.
 */
export interface MultiplayerState {
  enabled: boolean;
  isHost: boolean;
  roomId: string | null;
}

const DEFAULT: MultiplayerState = { enabled: false, isHost: false, roomId: null };

const MultiplayerContext = createContext<MultiplayerState>(DEFAULT);

export function MultiplayerProvider({
  value,
  children,
}: {
  value: MultiplayerState;
  children: ReactNode;
}) {
  return <MultiplayerContext.Provider value={value}>{children}</MultiplayerContext.Provider>;
}

export function useMultiplayer(): MultiplayerState {
  return useContext(MultiplayerContext);
}
