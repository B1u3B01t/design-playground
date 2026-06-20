"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Multiplayer session flags, available anywhere under PlaygroundClient via useMultiplayer().
 * Avoids threading roomId/isHost/enabled through the 4000-line PlaygroundCanvas as props.
 *
 * - `available`: the multiplayer feature is turned on for this user (the
 *   `playground-multiplayer-session` PostHog flag). Gates feature-entry UI such
 *   as the display-name field, which is shown even outside an active session.
 *   Always true when `enabled` is true.
 * - `enabled`: a room is active (Liveblocks providers are mounted above this).
 * - `isHost`: this participant runs the dev server + agent (see isSessionHost in liveblocks.config).
 * - `roomId`: the active room id, or null in single-player.
 */
export interface MultiplayerState {
  available: boolean;
  enabled: boolean;
  isHost: boolean;
  roomId: string | null;
}

const DEFAULT: MultiplayerState = { available: false, enabled: false, isHost: false, roomId: null };

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
