<!--
  Licensed to the Apache Software Foundation (ASF) under one
  or more contributor license agreements.  See the NOTICE file
  distributed with this work for additional information
  regarding copyright ownership.  The ASF licenses this file
  to you under the Apache License, Version 2.0 (the
  "License"); you may not use this file except in compliance
  with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, either express or implied.  See the License for the
  specific language governing permissions and limitations
  under the License.
-->

# Host verification checklist (requires a human)

Everything else about this widget has been verified programmatically — protocol
shape, data path, theming tokens, error handling, adapter output. **None of that
proves a single pixel renders.** Only a person with a real MCP Apps host can
close that gap.

This document is the minimal path from a clean machine to a screenshot, plus
exactly what to record. Until someone completes step 5, the claim "Superset
charts render natively in the chat" is **unproven**.

## The one rule that will waste your time if you ignore it

**MCP Apps hosts cache the `ui://` bundle per conversation.** The Claude app
downloads the widget HTML the first time a conversation renders it and never
re-fetches it for that conversation. Restarting Superset does not help.
Reconnecting the connector does not help.

> **Every time the bundle changes, start a BRAND-NEW conversation.**

If you are looking at stale behavior, this is almost certainly why. A second
defense is already in place: the resource URI is versioned
(`ui://superset/chart-viewer/v2`), so bumping it forces hosts to treat it as a
different resource — but the fresh-conversation rule is what you actually rely
on day to day.

## Setup

```bash
# 1. Get the current code (the bundle has changed several times; older
#    builds contain known-fixed defects)
git pull

# 2. Build the widget — the bundle is gitignored, so a fresh checkout has none
cd superset/mcp_service/chart/resources/chart_viewer
npm install
npm run build          # must print a dist/index.html size line

# 3. Start the MCP server (streamable-http; there is no stdio transport)
cd -
superset mcp run --port 5008 --debug
```

**Restart the server after any Python change.** A long-running process with a
mutated module graph produces misleading `cannot import name ...` errors that
look like dependency problems and are not. Restart first, diagnose second.

## Connecting a host

⚠️ **This step is not yet verified — capturing what actually works is part of
the task.** What is known:

- The server speaks **streamable-http on `http://127.0.0.1:5008`** (the MCP
  endpoint is conventionally `/mcp`). There is no stdio mode.
- **claude.ai (browser)** custom connectors will *not* work against localhost —
  Claude calls connectors from Anthropic's cloud, which cannot reach your
  machine. That path needs a public HTTPS URL or a tunnel.
- **Claude Desktop** is the intended target here precisely because it runs
  locally. Add the server under its connector/MCP settings pointing at the
  local URL.

If the local URL is rejected, fall back to a tunnel (e.g. `ngrok http 5008`)
and register the public HTTPS URL instead. **Record which method worked** — that
is the missing section of `MCP_APPS_CHART_VIEWER.md`.

## What to verify, in order

Do these in a **fresh conversation**. Chart IDs below are from the local test
instance; substitute equivalents if they differ.

| # | Prompt | Pass criteria | Why it matters |
|---|---|---|---|
| 1 | "Render Superset chart 113" | An actual **chart** appears inline — not a table of numbers, not prose | This is the entire thesis |
| 2 | — | Colors match the deployment theme (primary `#2893B3`, Inter font) — **not** the old `#20A7C9` | Consistency is the customer-stated reason this exists |
| 3 | Click the bar/line/area chips | Chart **morphs** between types with animation | The headline interaction |
| 4 | Click a data point | Drill-down re-queries; row count changes | Proves live data, not a snapshot |
| 5 | Drag across a time range | Zooms and re-queries; a Reset affordance appears | Proves brush → server round trip |
| 6 | "Render Superset chart 92" | Renders as a **table** | Second renderer path |
| 7 | Render a **big-number** chart | Large KPI value, not a chart | Different renderer (React, not ECharts) — highest untested risk |
| 8 | Render a chart with **2+ metrics** | Legend + metric toggle chips appear and work | Only path that exercises multi-series |
| 9 | Render an **unsupported type** (pie, deck.gl) | Falls back to a **styled table**, does not break | Graceful degradation |
| 10 | "Render Superset chart 99999" | A **readable error message**, not `MCP error -32600` | Regression check on a fixed defect |
| 11 | Click "Open in Superset" | Opens Explore for that chart | Escape hatch |
| 12 | Fullscreen / resize controls | Widget expands; chart re-fits | Recently added, never seen in a host |

## What to capture

- **Screenshot of #1** — this is the artifact the whole PoC exists to produce.
- Screenshots of #3, #7, #8 (the three highest-risk renderers).
- For any failure: the exact on-screen text, plus the `--debug` server log lines
  around that call.
- The connection method that worked (step "Connecting a host").

## If it does not render

Work down this list before concluding the widget is broken:

1. **Is it a fresh conversation?** (See the rule above. This is the most common
   cause by a wide margin.)
2. Did `npm run build` actually emit `dist/index.html`? If it is missing, the
   `ui://` resource serves a placeholder page that *says* it is a placeholder.
3. Did the server restart after the last Python change?
4. Does the host list `render_chart` at all? If not, the tool-pinning or
   descriptor path is the problem, not the widget.
5. Does the host show *something* (an error card, a blank frame)? A blank frame
   points at the iframe/CSP; an error card points at the data path.

## Status

- [ ] Rendered in Claude Desktop (screenshot)
- [ ] Connection method recorded
- [ ] Items 1–12 walked
- [ ] Failures filed

**Nothing in this file may be marked verified on the basis of wire-level or
unit-test evidence.** Those are already green and did not catch the defects that
a real host surfaced.
