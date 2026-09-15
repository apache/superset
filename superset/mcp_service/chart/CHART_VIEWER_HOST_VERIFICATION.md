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

## Staleness: four independent layers that fail in different directions

Most "the fix didn't work" reports on this widget have been something stale
rather than something broken. There is no single cache to clear. There are four
layers, they invalidate on different events, and — the part that keeps catching
people — two of them fail in *opposite* directions.

| Layer | Held by | Cleared by |
|---|---|---|
| `ui://` bundle HTML | host, per conversation | new conversation **or** a new digest |
| tool descriptor (points at the URI) | host, per conversation | new conversation only |
| `resources/list` response | **your own MCP client**, per connection | reconnecting that client |
| `mcp-remote` proxy processes | Claude Desktop | **restarting Desktop itself** |

**Bundle and descriptor make fixed code look broken.** The URI is
content-addressed (`ui://superset/chart-viewer/v4-<digest>`, the digest being a
hash of the built bundle), so a rebuild publishes under a URI the host has never
seen and cannot serve from cache. That defense is automatic — there is no
version to remember to bump. It does *not* cover the descriptor, which is what
points at the URI in the first place. Hence:

> **Every time the bundle changes, start a BRAND-NEW conversation.**

**The client's `resources/list` cache fails the other way — it makes a correctly
restarted server look like a failed restart.** An agent verifying the digest
through its own MCP client keeps seeing the pre-restart URI, because that
listing was captured when its connection opened. Acting on it means rebuilding
and restarting a server that was already right.

> **An agent's own MCP client listing is not admissible evidence after a server
> restart.** Query the server directly, with the bearer token, against the exact
> instance you intend to use:
>
> ```bash
> curl -s http://127.0.0.1:5008/mcp \
>   -H 'Content-Type: application/json' \
>   -H 'Accept: application/json, text/event-stream' \
>   -H "Authorization: Bearer $TOKEN" \
>   -d '{"jsonrpc":"2.0","id":1,"method":"resources/list"}' | grep -o 'ui://[^"]*'
> ```
>
> A check against a *different* process (one since replaced, or misconfigured)
> does not transfer to the one now listening.

**Dead proxies are why a fresh conversation is not sufficient.** Desktop reaches
the server through `mcp-remote` proxy processes that die with the server and do
not reconnect on their own. If `lsof -nP -iTCP:5008` shows `LISTEN` but no
`ESTABLISHED` connections, nothing is attached and every tool call fails no
matter how new the conversation is.

> **After restarting the MCP server: restart Claude Desktop, THEN open a fresh
> conversation.** In that order.

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
#    SUPERSET_CONFIG_PATH is REQUIRED — see below. Do not omit it.
cd -
SUPERSET_CONFIG_PATH=$PWD/superset_config.py superset mcp run --port 5008 --debug
```

**Set `SUPERSET_CONFIG_PATH` explicitly, even from the repo root.** `superset`
is a console script, so `sys.path[0]` is `venv/bin`, not your checkout — the
repo root is *not* importable and `superset_config.py` is silently skipped.
The server then starts, listens, and serves the correct widget bundle, but with
no local config: no `MCP_DEV_USERNAME`, no `MCP_JWT_*`, so FastMCP comes up with
`auth=False` and every `render_chart` returns
`Authentication required. No valid credentials provided.`

This is easy to misread as a widget or auth-code bug. Check the startup log:

| Log line | Meaning |
|---|---|
| `A Default SECRET_KEY was detected` | **config was NOT loaded** — restart with the path set |
| `Loaded your LOCAL configuration at [...]` + `auth=True` | config loaded correctly |

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
| 12a | Click **⛶ Maximize** | Widget expands; chart re-fits | — |
| 12b | Click the widget's own **⤡ Restore** | Returns to its original size | Shipped broken once; see note below |
| 12c | Click **Claude's native close button** (fullscreen header bar) | Returns to its original size | Different code path from 12b |
| 12d | Drag the resize handle | Height follows the drag | Host-independent path |

> **12b and 12c are not the same test.** Claude renders its *own* close control
> in the fullscreen header while the widget renders `⤡` — two affordances, two
> code paths. 12b goes out through `ui/request-display-mode` and depends on the
> widget handling a host that grants, declines, or ignores the request. 12c
> arrives purely as a `host-context-changed` push and never touches that code.
> A collapse bug can affect either one alone, so **record which control you
> used** — "collapse works" is not a single claim.

## What to capture

- **Screenshot of #1** — this is the artifact the whole PoC exists to produce.
- Screenshots of #3, #7, #8 (the three highest-risk renderers).
- For any failure: the exact on-screen text, plus the `--debug` server log lines
  around that call.
- The connection method that worked (step "Connecting a host").

## If it does not render

Work down this list before concluding the widget is broken:

1. **Is it a fresh conversation, on a Desktop restarted since the server was?**
   (See the staleness table. This is the most common cause by a wide margin,
   and a fresh conversation alone is not enough once the server has restarted.)
2. **Does every call fail with "Authentication required"?** That is the
   config-less server described under Setup, not a widget fault. Grep the
   startup log for `A Default SECRET_KEY was detected` and restart with
   `SUPERSET_CONFIG_PATH` set.
3. Did `npm run build` actually emit `dist/index.html`? If it is missing, the
   `ui://` resource serves a placeholder page that *says* it is a placeholder.
4. Did the server restart after the last Python change?
5. Does the host list `render_chart` at all? If not, the tool-pinning or
   descriptor path is the problem, not the widget.
6. Does the host show *something* (an error card, a blank frame)? A blank frame
   points at the iframe/CSP; an error card points at the data path.

## Status

- [ ] Rendered in Claude Desktop (screenshot)
- [ ] Connection method recorded
- [ ] Items 1–12 walked
- [ ] Failures filed

**Nothing in this file may be marked verified on the basis of wire-level or
unit-test evidence.** Those are already green and did not catch the defects that
a real host surfaced.
