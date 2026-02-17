# Playground Setup

## Quick Start

1. Copy the `playground/` folder into your Next.js project's `src/app/` directory
2. Open a terminal in your project root
3. Run the setup script:
   ```
   node src/app/playground/setup.mjs
   ```
4. Start your project (`npm run dev` or `npm run build && npm start`)
5. Open `http://localhost:3000/playground`

## Manual Install

If you prefer to skip the script, run this single command from your project root:

```
npm install @xyflow/react lucide-react @radix-ui/react-alert-dialog @radix-ui/react-dialog @radix-ui/react-tooltip @radix-ui/react-slot class-variance-authority clsx tailwind-merge
```

Replace `npm install` with `pnpm install`, `yarn add`, or `bun install` depending on your package manager.

## Prerequisites

Your project needs these already installed:

- **Next.js** (App Router, v13+)
- **React** 18 or 19
- **Tailwind CSS** v4

The UI uses CSS theme variables (`--background`, `--primary`, `--muted`, etc.). If your project uses [shadcn/ui](https://ui.shadcn.com), these are already set up. If not, you may need to add them to your global stylesheet — see the [shadcn/ui theming docs](https://ui.shadcn.com/docs/theming).

## How It Works

1. **Drag** components from the sidebar onto the canvas
2. **Generate variations** by clicking the sparkle icon on any component (requires Cursor CLI)
3. **Compare** variations side-by-side on the canvas
4. **Use a variation** by clicking "Use this" to copy the import path
5. **Delete** variations you don't want — files are removed from your project automatically

## AI Generation

The variation generator uses Cursor's agent CLI. This requires the [Cursor CLI](https://cursor.com/docs/cli/installation) to be installed and in your PATH. The setup script (`node src/app/playground/setup.mjs`) checks for it and will tell you if it's missing. Without it, everything else works — you just won't be able to generate new variations from the UI.

## Removing the Playground

Delete the `src/app/playground/` folder. Then optionally uninstall packages you no longer need:

```
npm uninstall @xyflow/react lucide-react @radix-ui/react-alert-dialog @radix-ui/react-dialog @radix-ui/react-tooltip @radix-ui/react-slot class-variance-authority clsx tailwind-merge
```
