# Design Playground

> Drag components onto a canvas and generate AI-powered layout and style variations — right inside your Next.js project.

## Quick Start

```bash
# 1. Run the setup script
node src/app/playground/setup.mjs

# 2. Start your dev server
npm run dev

# 3. Open the playground
# Visit http://localhost:3000/playground
```

## Requirements

- **Next.js 13+** with App Router
- **React 18 or 19**
- **Tailwind CSS v4**
- **Node.js 18+**
- At least one AI provider CLI installed (see [Providers](#providers) below)

## What Gets Installed

The playground lives entirely in `app/playground/` — no global config changes, no wrappers. To uninstall, delete that folder and remove its dependencies from your `package.json`.

The setup script checks your project, detects your package manager, and installs only what's missing.

---

## How It Works

1. **Discover** your project's existing components with one click
2. **Drag** components onto an infinite canvas
3. **Iterate** — the AI generates layout and style variations automatically
4. **Compare** variations side-by-side on the canvas
5. **Copy** the code you like back into your project

Everything happens locally. Your code stays on your machine.

---

## Providers

The playground supports two AI provider CLIs. You can switch between them from **Model Settings** in the toolbar.

### Cursor (Default)

The Cursor editor's agent CLI. If you use Cursor as your editor, this is already available.

- [Install Cursor](https://cursor.com)
- Enable the CLI: Cursor → Settings → Enable CLI

### Claude Code

Anthropic's command-line coding agent.

```bash
npm install -g @anthropic-ai/claude-code
```

Claude Code offers additional options you can configure in Model Settings:

| Option       | Description                              | Default |
| ------------ | ---------------------------------------- | ------- |
| Effort Level | How thoroughly the AI explores solutions | High    |
| Budget Limit | Maximum spend per generation (USD)       | No limit|
| Max Turns    | Maximum conversation turns per generation| No limit|

---

## Canvas Basics

- **Pan** — Click and drag on empty space, or use the scroll wheel
- **Zoom** — Pinch or Ctrl/Cmd + scroll
- **Select** — Click a component card
- **Multi-select** — Shift + click, or drag a selection box
- **Delete** — Select a card and press Backspace/Delete

### Component Cards

Each card on the canvas shows a live preview of a component variation. Cards display:

- A rendered preview of the component
- The model that generated it
- The iteration number
- Actions: copy code, iterate further, view full screen

---

## Generating Variations

### From the Canvas

1. Select a component card
2. Click **Iterate** or press **Enter**
3. Optionally add a prompt describing what you want changed
4. Choose how many variations to generate
5. New variations appear as connected cards on the canvas

### From Chat

Use the built-in chat panel to describe what you want in natural language. The AI will generate or modify components based on your description.

- **Shift + Tab** — Cycle through available models in chat
- **Enter** — Send your message
- **Shift + Enter** — New line

---

## Project Discovery

Click **Discover** in the toolbar to scan your project for existing React components. The playground will:

1. Find all component files in your project
2. Analyze each component's props, variants, and structure
3. Add them to your component library for use on the canvas

---

## Skills

The playground includes built-in prompt templates (called "skills") for common tasks:

| Skill             | What It Does                                        |
| ----------------- | --------------------------------------------------- |
| **Iterate**       | Generate style and layout variations of a component |
| **Landing Page**  | Create full landing page designs                    |
| **Design System** | Build consistent component libraries                |
| **Dashboard**     | Generate data dashboard layouts                     |

Skills provide optimized prompts so you get better results without needing to write detailed instructions yourself.

---

## Model Settings

Open **Model Settings** from the toolbar gear icon to:

- Switch between Cursor and Claude Code providers
- Enable or disable specific AI models
- Configure Claude Code advanced options (effort, budget, turns)
- Refresh the available model list

Your provider and model preferences are saved in your browser and persist across sessions.

---

## Project Structure

```
app/playground/
├── api/               # Backend API routes (generate, discover, models)
├── lib/               # Shared utilities, stores, provider configs
├── nodes/             # Canvas node components (cards, groups)
├── ui/                # Reusable UI components (dialog, tabs, etc.)
├── skills/            # Built-in prompt templates
├── docs/              # Technical documentation
├── setup.mjs          # Setup script
└── page.tsx           # Main playground page
```

---

## Troubleshooting

**"Provider not found" error**
Make sure your chosen CLI is installed and available in your terminal's PATH. Run `cursor --version` or `claude --version` to verify.

**Models not loading**
Click the refresh button in Model Settings. If using Cursor, make sure the Cursor app is running.

**Generation seems stuck**
Check your terminal for error output. You can cancel an in-progress generation from the canvas toolbar.

**Components not discovered**
Make sure your components are standard React/JSX files. The discovery scan looks for `.tsx` and `.jsx` files with default exports.
