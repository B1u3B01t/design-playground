import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ITERATIONS_DIR = path.join(process.cwd(), 'src/app/playground/iterations');
const INDEX_FILE = path.join(ITERATIONS_DIR, 'index.ts');

export interface IterationFile {
  filename: string;
  componentName: string;
  iterationNumber: number;
  parentId: string;
  mode: 'layout' | 'vibe' | 'unknown';
  description: string;
}

function parseIterationFile(filename: string): IterationFile | null {
  // Match pattern: ComponentName.iteration-N.tsx
  const match = filename.match(/^(.+)\.iteration-(\d+)\.tsx$/);
  if (!match) return null;

  const componentName = match[1];
  const iterationNumber = parseInt(match[2], 10);
  
  // Try to read metadata from file
  let mode: 'layout' | 'vibe' | 'unknown' = 'unknown';
  let description = '';
  
  try {
    const filePath = path.join(ITERATIONS_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Parse metadata comment
    const modeMatch = content.match(/@mode\s+(Layout|Vibe)/i);
    if (modeMatch) {
      mode = modeMatch[1].toLowerCase() as 'layout' | 'vibe';
    }
    
    const descMatch = content.match(/@description\s+(.+)/);
    if (descMatch) {
      description = descMatch[1].trim();
    }
  } catch {
    // Ignore read errors
  }

  // Map component name to registry ID
  const parentId = componentName
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '')
    .replace(/\s+/g, '-');

  return {
    filename,
    componentName,
    iterationNumber,
    parentId,
    mode,
    description,
  };
}

// Generate the index.ts content based on existing iteration files
function generateIndexContent(iterations: IterationFile[]): string {
  if (iterations.length === 0) {
    return `// Auto-generated index for iteration components
// This file maps iteration filenames to their components

import { ComponentType } from 'react';

// No iterations currently registered

// Map of filename to component
export const iterationComponents: Record<string, ComponentType<Record<string, unknown>>> = {};

export function getIterationComponent(filename: string): ComponentType<Record<string, unknown>> | undefined {
  return iterationComponents[filename];
}
`;
  }

  // Group by component name for organized imports
  const byComponent = new Map<string, IterationFile[]>();
  for (const iter of iterations) {
    const existing = byComponent.get(iter.componentName) || [];
    existing.push(iter);
    byComponent.set(iter.componentName, existing);
  }

  // Generate import statements
  const imports: string[] = [];
  for (const [componentName, iters] of byComponent) {
    imports.push(`// Import all ${componentName} iterations`);
    for (const iter of iters.sort((a, b) => a.iterationNumber - b.iterationNumber)) {
      const importName = `${componentName}Iteration${iter.iterationNumber}`;
      const moduleName = iter.filename.replace('.tsx', '');
      imports.push(`import ${importName} from './${moduleName}';`);
    }
    imports.push('');
  }

  // Generate map entries
  const mapEntries: string[] = [];
  for (const [componentName, iters] of byComponent) {
    for (const iter of iters.sort((a, b) => a.iterationNumber - b.iterationNumber)) {
      const importName = `${componentName}Iteration${iter.iterationNumber}`;
      mapEntries.push(`  '${iter.filename}': ${importName} as ComponentType<Record<string, unknown>>,`);
    }
  }

  return `// Auto-generated index for iteration components
// This file maps iteration filenames to their components

import { ComponentType } from 'react';

${imports.join('\n')}
// Map of filename to component
export const iterationComponents: Record<string, ComponentType<Record<string, unknown>>> = {
${mapEntries.join('\n')}
};

export function getIterationComponent(filename: string): ComponentType<Record<string, unknown>> | undefined {
  return iterationComponents[filename];
}
`;
}

// Regenerate the index.ts file based on current iteration files
function regenerateIndex(): void {
  const files = fs.readdirSync(ITERATIONS_DIR);
  const iterations: IterationFile[] = [];

  for (const file of files) {
    // Skip index.ts itself
    if (file === 'index.ts') continue;
    
    if (file.endsWith('.tsx')) {
      const parsed = parseIterationFile(file);
      if (parsed) {
        iterations.push(parsed);
      }
    }
  }

  // Sort by component name and iteration number
  iterations.sort((a, b) => {
    if (a.componentName !== b.componentName) {
      return a.componentName.localeCompare(b.componentName);
    }
    return a.iterationNumber - b.iterationNumber;
  });

  const indexContent = generateIndexContent(iterations);
  fs.writeFileSync(INDEX_FILE, indexContent, 'utf-8');
}

// GET - Scan iterations folder
export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    // Ensure directory exists
    if (!fs.existsSync(ITERATIONS_DIR)) {
      return NextResponse.json({ iterations: [] });
    }

    const files = fs.readdirSync(ITERATIONS_DIR);
    const iterations: IterationFile[] = [];

    for (const file of files) {
      // Skip index.ts
      if (file === 'index.ts') continue;
      
      if (file.endsWith('.tsx')) {
        const parsed = parseIterationFile(file);
        if (parsed) {
          iterations.push(parsed);
        }
      }
    }

    // Sort by component name and iteration number
    iterations.sort((a, b) => {
      if (a.componentName !== b.componentName) {
        return a.componentName.localeCompare(b.componentName);
      }
      return a.iterationNumber - b.iterationNumber;
    });

    return NextResponse.json({ iterations });
  } catch (error) {
    console.error('Error scanning iterations:', error);
    return NextResponse.json({ error: 'Failed to scan iterations' }, { status: 500 });
  }
}

// DELETE - Delete a specific iteration file and update index
export async function DELETE(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const { filename } = await request.json();
    
    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'Filename required' }, { status: 400 });
    }

    // Validate filename pattern to prevent directory traversal
    if (!filename.match(/^[A-Za-z0-9]+\.iteration-\d+\.tsx$/)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const filePath = path.join(ITERATIONS_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Delete the iteration file
    fs.unlinkSync(filePath);
    
    // Regenerate index.ts to remove the deleted iteration
    regenerateIndex();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting iteration:', error);
    return NextResponse.json({ error: 'Failed to delete iteration' }, { status: 500 });
  }
}

// POST - Regenerate index (can be called after creating new iterations)
export async function POST() {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    regenerateIndex();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error regenerating index:', error);
    return NextResponse.json({ error: 'Failed to regenerate index' }, { status: 500 });
  }
}
