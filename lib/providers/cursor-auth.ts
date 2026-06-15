import { execFile, spawn, type ChildProcess } from 'child_process';
import {
  CURSOR_AUTH_ERROR_PATTERN,
  CURSOR_AUTH_USER_MESSAGE,
} from '../cursor-auth-constants';
import { cursorProvider } from './cursor';

export { CURSOR_AUTH_ERROR_PATTERN, CURSOR_AUTH_USER_MESSAGE };

const CLI_BINARY = cursorProvider.binary;
const PROBE_TIMEOUT_MS = 10_000;

export interface CursorAuthStatus {
  cliInstalled: boolean;
  authenticated: boolean;
  email: string | null;
  error?: string;
}

/** True when stderr/stdout indicates missing Cursor CLI. */
export function isCursorCliMissing(message: string): boolean {
  return message.includes('ENOENT') || /not found|command not found/i.test(message);
}

function execCursor(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(CLI_BINARY, args, { timeout: PROBE_TIMEOUT_MS }, (error, stdout, stderr) => {
      if (error && isCursorCliMissing(error.message)) {
        reject(new Error('ENOENT'));
        return;
      }
      resolve({
        stdout: String(stdout ?? ''),
        stderr: String(stderr ?? ''),
      });
    });
  });
}

function parseAuthOutput(text: string): { authenticated: boolean; email: string | null } {
  const normalized = text.trim();
  if (!normalized) {
    return { authenticated: false, email: null };
  }

  if (/not logged in/i.test(normalized)) {
    return { authenticated: false, email: null };
  }

  const emailMatch =
    normalized.match(/(?:logged in as|user email)[:\s]+(\S+@\S+)/i) ??
    normalized.match(/(\S+@\S+)/);
  if (emailMatch) {
    return { authenticated: true, email: emailMatch[1] };
  }

  if (/logged in/i.test(normalized)) {
    return { authenticated: true, email: null };
  }

  return { authenticated: false, email: null };
}

/** Probe Cursor CLI install + login state. */
export async function checkCursorAuth(): Promise<CursorAuthStatus> {
  try {
    await execCursor([cursorProvider.versionFlag]);
  } catch {
    return {
      cliInstalled: false,
      authenticated: false,
      email: null,
      error: cursorProvider.notFoundMessage,
    };
  }

  if (process.env.CURSOR_API_KEY?.trim()) {
    return {
      cliInstalled: true,
      authenticated: true,
      email: null,
    };
  }

  try {
    const status = await execCursor(['agent', 'status']);
    const parsed = parseAuthOutput(`${status.stdout}\n${status.stderr}`);
    if (parsed.authenticated) {
      return { cliInstalled: true, ...parsed };
    }
  } catch {
    // Fall through to whoami / about.
  }

  try {
    const whoami = await execCursor(['agent', 'whoami']);
    const parsed = parseAuthOutput(`${whoami.stdout}\n${whoami.stderr}`);
    if (parsed.authenticated) {
      return { cliInstalled: true, ...parsed };
    }
  } catch {
    // Fall through to about.
  }

  try {
    const about = await execCursor(['agent', 'about']);
    const aboutText = `${about.stdout}\n${about.stderr}`;
    if (/not logged in/i.test(aboutText)) {
      return { cliInstalled: true, authenticated: false, email: null };
    }
    const emailLine = aboutText.match(/User Email\s+(\S+@\S+)/i);
    if (emailLine) {
      return {
        cliInstalled: true,
        authenticated: true,
        email: emailLine[1],
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isCursorCliMissing(message)) {
      return {
        cliInstalled: false,
        authenticated: false,
        email: null,
        error: cursorProvider.notFoundMessage,
      };
    }
  }

  return { cliInstalled: true, authenticated: false, email: null };
}

// ---------------------------------------------------------------------------
// Login subprocess (single instance)
// ---------------------------------------------------------------------------

let loginProcess: ChildProcess | null = null;

export function isCursorLoginInProgress(): boolean {
  if (!loginProcess?.pid) return false;
  try {
    process.kill(loginProcess.pid, 0);
    return true;
  } catch {
    loginProcess = null;
    return false;
  }
}

/** Spawn `cursor agent login` detached; opens the user's browser. */
export function startCursorLogin(): { started: boolean; alreadyInProgress?: boolean; error?: string } {
  if (isCursorLoginInProgress()) {
    return { started: false, alreadyInProgress: true };
  }

  try {
    const child = spawn(CLI_BINARY, ['agent', 'login'], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    });
    child.unref();
    loginProcess = child;

    child.on('close', () => {
      if (loginProcess === child) {
        loginProcess = null;
      }
    });

    child.on('error', () => {
      if (loginProcess === child) {
        loginProcess = null;
      }
    });

    return { started: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isCursorCliMissing(message)) {
      return { started: false, error: cursorProvider.notFoundMessage };
    }
    return { started: false, error: message };
  }
}

