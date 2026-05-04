import { NextResponse } from 'next/server';
import fs from 'fs';
import {
  isPackageInstalled,
  designMdExists,
  designMdPath,
} from '../../../lib/design-md-helpers';

export const runtime = 'nodejs';

export async function GET() {
  const { installed, version } = isPackageInstalled();
  const fileExists = designMdExists();
  let fileSize: number | null = null;
  if (fileExists) {
    try {
      fileSize = fs.statSync(designMdPath()).size;
    } catch {
      fileSize = null;
    }
  }
  return NextResponse.json({
    installed,
    packageVersion: version ?? null,
    fileExists,
    filePath: designMdPath(),
    fileSize,
  });
}
