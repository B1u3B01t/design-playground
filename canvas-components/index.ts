'use client';
// Seed file for on-canvas JSX components.
// This ensures the playground works even before any JSX components are generated.
import type { ComponentType } from 'react';

export const canvasComponents: Record<string, ComponentType<any>> = {};

export function getOnCanvasComponent(filename: string): ComponentType<any> | undefined {
  return canvasComponents[filename];
}