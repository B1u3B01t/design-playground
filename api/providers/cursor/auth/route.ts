import { NextResponse } from 'next/server';
import {
  checkCursorAuth,
  startCursorLogin,
} from '../../../../lib/providers/cursor-auth';
import { isLocalRequest } from '../../../../lib/telemetry/server';

export async function GET(req: Request) {
  try {
    const status = await checkCursorAuth();
    const local = isLocalRequest(req);
    return NextResponse.json({
      success: true,
      cliInstalled: status.cliInstalled,
      authenticated: status.authenticated,
      email: local ? status.email : null,
      ...(status.error ? { error: status.error } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        cliInstalled: false,
        authenticated: false,
        email: null,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Cursor sign-in is only available on localhost.',
      },
      { status: 403 },
    );
  }

  const result = startCursorLogin();

  if (result.alreadyInProgress) {
    return NextResponse.json({
      success: true,
      started: false,
      alreadyInProgress: true,
    });
  }

  if (!result.started) {
    return NextResponse.json(
      {
        success: false,
        error: result.error ?? 'Failed to start Cursor sign-in.',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    started: true,
  });
}
