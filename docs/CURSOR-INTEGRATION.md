# Cursor Agent Integration

## Overview

The playground can trigger iteration generation via the Cursor CLI directly from the UI. Click **"Run with Cursor"** in the Iterate dialog to start.

## Requirements

- Cursor CLI installed and in PATH
- Run `cursor agent login` if not authenticated

## How It Works

1. **Start**: User clicks "Run with Cursor" → dialog closes, skeleton placeholders appear
2. **Execute**: API spawns `cursor agent --print --force` and pipes the prompt via stdin
3. **Wait**: HTTP request stays open until the agent completes (no polling)
4. **Complete**: Response triggers cleanup of skeletons and scan for new iterations

## Key Files

| File | Purpose |
|------|---------|
| `/playground/api/generate/route.ts` | Spawns cursor agent, manages state |
| `ComponentNode.tsx` | IterateDialog, CancelGenerationButton |
| `PlaygroundCanvas.tsx` | Handles skeleton nodes, completion events |
| `SkeletonIterationNode.tsx` | Loading placeholder component |

## API Endpoints

| Method | Action |
|--------|--------|
| `POST` | Start generation (waits for completion) |
| `DELETE` | Cancel running generation |
| `GET ?action=download-chat` | Download agent output log |

## Chat Logs

Agent output is saved to `.cursor-temp/chat-{component}-{timestamp}.txt`. Download available via the button next to Cancel during generation.

## Events

| Event | Triggered When |
|-------|----------------|
| `GENERATION_START` | Run with Cursor clicked |
| `GENERATION_COMPLETE` | Agent exits successfully |
| `GENERATION_ERROR` | Agent fails or user cancels |

## Cancellation

- Click **Cancel** on the component node during generation
- Sends SIGTERM to the agent process
- Dispatches error event to clean up skeletons

## Limitations

- One generation at a time (enforced by API lock)
- Agent output not streamed live (only available after completion)
- Files created before cancellation remain on disk
