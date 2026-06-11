# Telemetry

Design Playground collects **completely anonymous, content-free usage telemetry**
during local development. This document describes exactly what is collected, what
is never collected, and every way to opt out.

Telemetry exists so we can answer questions like *"which features get used?"*,
*"how long do generations take?"*, and *"what breaks in the wild?"* — and
prioritize accordingly.

## Principles

1. **Dev-only.** Telemetry runs only under `next dev` on your machine. It is
   structurally impossible in production builds of your app: the API route
   returns 404, the server module is inert, and the client helper is dead code.
   Your deployed app and its users are never touched.
2. **Content-free by construction.** Every event passes through a strict
   allowlist ([`lib/telemetry/schema.ts`](lib/telemetry/schema.ts)) before it can
   leave your machine. Only pre-declared property names with pre-declared types
   pass; string values must match a fixed enum. There is no code path by which a
   prompt, your code, a file path, or a component name can be transmitted.
3. **Anonymous.** Your identity is a random UUID with no connection to you, your
   machine, or your project. PostHog is configured to discard IP addresses.
4. **Auditable.** The single file that talks to the network is
   [`lib/telemetry/server.ts`](lib/telemetry/server.ts) (~300 lines). Run with
   `PLAYGROUND_TELEMETRY_DEBUG=1` to print every event to your terminal instead
   of sending it.
5. **Guests are never recorded.** Multiplayer participants joining via a shared
   room/tunnel link never saw this notice, so nothing they trigger is recorded —
   client-side and server-side (tunnel-origin requests are dropped).

## What is NEVER collected

- Prompts, chat messages, or any text you type
- Your code, generated code, diffs, or file contents
- File paths, file names, component names, page names
- Your project's name or directory (the project id is a salted one-way hash —
  see `project_hash` below)
- Custom skill names (reported only as `custom`)
- Room IDs, share URLs, tunnel URLs, display names
- Raw error messages or stack traces (errors are reported as fixed category
  enums like `timeout` or `cli_not_found`)
- IP addresses (discarded server-side at PostHog), geolocation
- Anything at all from multiplayer guests

## What is collected

Common properties on every event: a random machine UUID (`distinct_id`), a random
per-dev-server-session UUID, the playground version, schema version, OS platform
(`darwin`/`linux`/`win32`), and Node.js major version.

| Event | Properties | When |
|---|---|---|
| `setup_completed` | which agent CLIs were detected (booleans), OS, node version | once, when `setup.mjs` finishes |
| `session_started` | multiplayer on/off, which agent CLIs are on PATH (booleans), whether Liveblocks is configured (boolean), `project_hash` | once per browser session |
| `time_summary` | seconds spent active / passive / generating (10-minute aggregate buckets), counts of nodes added by type | every 10 minutes while the playground is open |
| `discovery_run` | duration, outcome enum, number of components/pages found | after a discovery scan |
| `generation_started` | provider, model (known ids only, else `custom`), iteration count, source enum (dialog/drag/chat/…), builtin skill ids (custom skills → `custom`), render mode, effort level | when a generation starts |
| `generation_completed` | the above + duration, time to first iteration, iterations detected, lines added/removed + files changed (numbers only) | when a generation succeeds |
| `generation_failed` | provider/model/source + duration + error category enum | when a generation fails |
| `code_adopted` | kind (flow/iteration), lines added/removed, files changed (numbers only) | when generated code is adopted into your project |
| `feature_used` | feature enum (`pdf_import`, `draw`, `flow_simulator_play`, `prompt_copied`, `tunnel_started`, `multiplayer_session_started`, `design_system_generated`), page count for PDFs | on feature use |
| `error_occurred` | area enum + category enum (never messages) | on render/route errors |
| `telemetry_opt_out` | method | the final event before the UI toggle disables telemetry |

Notes on specific values:

- **`project_hash`** is `sha256(yourRandomMachineId + projectPath)` truncated to
  16 hex chars. It lets us count *how many distinct projects* use the playground
  without ever learning what any project is. It cannot be reversed, and the same
  project on a different machine produces a different hash, so it cannot be used
  to correlate across users.
- **Time tracking** is aggregate-only: each 10-minute window reports three
  numbers (active/passive/generation seconds). Individual keystrokes, mouse
  positions, and interaction timings never leave your machine. "Active" means
  the tab was visible with input in the last 60 seconds; "generation" counts
  while an agent is running (even with the tab hidden).
- **Lines added/removed** are computed from `git diff --numstat` totals
  snapshotted immediately before and after the playground's *own* write
  operations (generations, edits, adoptions), plus line counts of the iteration
  files it wrote. Telemetry never reads your git history — no `git log`, no
  branches, no commits, no remotes, no GitHub access. If you edit files in
  parallel while a generation runs, those edits can bleed into the totals;
  they are numbers either way.

## How to opt out

Any one of these works:

| Method | Scope |
|---|---|
| Toggle "Anonymous telemetry" off in **Model Settings** | this machine, persistent |
| `PLAYGROUND_TELEMETRY_DISABLED=1` | wherever the env var is set |
| `DO_NOT_TRACK=1` ([consoledonottrack.com](https://consoledonottrack.com)) | wherever the env var is set |
| Edit `~/.config/design-playground/telemetry.json` → `"enabled": false` | this machine, persistent |

CI environments are auto-detected and always excluded. The config file lives at
`%APPDATA%\design-playground\telemetry.json` on Windows,
`$XDG_CONFIG_HOME/design-playground/telemetry.json` or
`~/.config/design-playground/telemetry.json` elsewhere. Deleting it resets the
anonymous ID.

### Transparency mode

```
PLAYGROUND_TELEMETRY_DEBUG=1 npm run dev
```

prints every event (exactly what would be sent) to your terminal and sends
nothing.

## Where the data goes

Events are batched on your dev server (never sent directly from the browser) and
forwarded to PostHog Cloud EU (`eu.i.posthog.com`). Every event sets
`$geoip_disable: true` (no location is ever derived — enforced in code, not just
project settings) and `$process_person_profile: false` (anonymous events, no
person profiles). The PostHog project is additionally configured to discard
client IPs and disable session recording and autocapture.

## Abuse posture (an honest note)

The PostHog ingestion key in `lib/telemetry/server.ts` is a **write-only public
key** — it cannot read any data. Because this is an open-source repo, the key is
necessarily public; anyone could send junk events with it. We limit the blast
radius rather than pretend to prevent this: strict event allowlists, in-process
rate caps, a hard billing cap on the PostHog project, IP discarding (so even
abusive traffic carries no PII), and dashboard filters on shipped
`playground_version` values. If the key is abused we rotate it in a release;
older checkouts then silently no-op (telemetry is fire-and-forget and never
surfaces errors).

## Retention

Event data is retained in PostHog for at most 12 months and is used only in
aggregate (counts, distributions, retention curves). It is never sold or shared.
