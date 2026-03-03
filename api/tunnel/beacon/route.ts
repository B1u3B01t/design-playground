/**
 * Beacon endpoint — called by sendBeacon() on tab close.
 * sendBeacon only supports POST, so this proxies to the DELETE logic.
 */
import { NextResponse } from 'next/server';
import { DELETE } from '../route';

export async function POST() {
  await DELETE();
  return NextResponse.json({ ok: true });
}
