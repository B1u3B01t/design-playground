import { spawn } from 'child_process';
import fs from 'fs';
import { localBinPath, isPackageInstalled, DESIGN_MD_PACKAGE } from './design-md-helpers';

export interface CliResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  command: string;
  error?: string;
}

/** Run the local design.md binary. Falls back to `npx --no-install` if the binary symlink is missing. */
export function runDesignMdCli(args: string[], stdinData?: string): Promise<CliResult> {
  return new Promise((resolve) => {
    const { installed } = isPackageInstalled();
    if (!installed) {
      resolve({
        ok: false,
        exitCode: null,
        stdout: '',
        stderr: '',
        command: `design.md ${args.join(' ')}`,
        error: `${DESIGN_MD_PACKAGE} is not installed. Click "Set up design system" first.`,
      });
      return;
    }

    const binPath = localBinPath();
    let cmd: string;
    let cmdArgs: string[];
    if (fs.existsSync(binPath)) {
      cmd = binPath;
      cmdArgs = args;
    } else {
      cmd = 'npx';
      cmdArgs = ['--no-install', 'design.md', ...args];
    }

    const child = spawn(cmd, cmdArgs, {
      cwd: process.cwd(),
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: [stdinData ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (b: Buffer) => { stdout += b.toString('utf8'); });
    child.stderr?.on('data', (b: Buffer) => { stderr += b.toString('utf8'); });

    if (stdinData && child.stdin) {
      child.stdin.write(stdinData);
      child.stdin.end();
    }

    child.on('error', (err) => {
      resolve({
        ok: false,
        exitCode: null,
        stdout,
        stderr,
        command: `${cmd} ${cmdArgs.join(' ')}`,
        error: err.message,
      });
    });

    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        exitCode: code,
        stdout,
        stderr,
        command: `${cmd} ${cmdArgs.join(' ')}`,
      });
    });
  });
}
