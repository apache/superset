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

# Native chart rendering via MCP Apps (`render_chart`)

Proof-of-concept: Superset MCP tools that return a chart as a **real interactive
visualization** inside MCP Apps hosts (Claude web/desktop, ChatGPT, VS Code
Copilot, Cursor, Goose, ...), instead of prose the model has to describe.

Built against the **MCP Apps extension (SEP-1865, stable 2026-01-26)**. See the
research write-up: `mcp-native-viz-research.md` (repo root).

## Architecture

```
LLM host (Claude/ChatGPT)
  │  tools/call render_chart {identifier: 42}
  ▼
render_chart tool ──► get_chart_data_core ──► ChartDataCommand (RBAC + RLS)
  │  returns ChartData (structuredContent) + text summary
  │  tool descriptor carries _meta.ui.resourceUri = ui://superset/chart-viewer/v2
  ▼
host fetches ui:// resource ──► chart_viewer/dist/index.html (sandboxed iframe)
  │  bridge: JSON-RPC 2.0 over postMessage
  ▼
ECharts widget renders line/bar/area/big-number/table
  │  user interacts (drill / zoom / filter)
  ▼
widget tools/call render_chart_requery ──► get_chart_data_core (same authz path)
```

Key pieces:

| Piece | Location |
|---|---|
| `render_chart` + `render_chart_requery` tools | `chart/tool/render_chart.py` |
| Shared authorized data path | `chart/tool/get_chart_data.py` (`get_chart_data_core`) |
| `ui://` resource (serves the bundle) | `chart/resources/chart_viewer.py` |
| Widget source (React + ECharts + Vite) | `chart/resources/chart_viewer/` |
| Built single-file bundle (gitignored) | `chart/resources/chart_viewer/dist/index.html` |
| Schemas | `chart/schemas.py` (`RenderChartRequest`, `RenderChartRequeryRequest`, `ChartData.explore_url`) |
| Stripper keep-list + tool pinning | `middleware.py`, `mcp_config.py` |
| `@tool(meta=...)` plumbing | `superset-core/.../mcp/decorators.py`, `superset/core/mcp/core_mcp_injection.py` |

## Extension capability declaration (`io.modelcontextprotocol/ui`)

Superset declares nothing here, and deliberately so. FastMCP's low-level server
adds the extension to the `initialize` response itself, unconditionally:

```
"capabilities": {..., "extensions": {"io.modelcontextprotocol/ui": {}}}
```

Verified by round-tripping `initialize` against the real
`superset.mcp_service.app.mcp` instance (fastmcp 3.4.2). `mcp.types.ServerCapabilities`
has no `extensions` field, but it is `extra="allow"`, so FastMCP attaches it as
a pydantic extra and it survives serialization — the same trick it uses for
`tasks`.

`FastMCP(...)` does accept an `experimental_capabilities=` kwarg, and passing
`{"io.modelcontextprotocol/ui": {...}}` through it works without error — but it
lands under the legacy `experimental` map, *alongside* the already-correct
`extensions` entry. That would give hosts two sources of truth for one
capability, so it is intentionally not done.

Because the declaration comes from the SDK rather than from Superset code, it is
pinned by `tests/unit_tests/mcp_service/test_mcp_apps_capability.py`: an SDK bump
that stops advertising the extension fails there instead of silently degrading
every MCP Apps host to a plain-text tool result.

## Why the two infra changes were required

Superset's MCP service has two defaults that block MCP Apps out of the box; both
are handled without weakening them globally:

1. **`StructuredContentStripperMiddleware`** strips `outputSchema` /
   `structuredContent` from every tool (a Claude-bridge workaround). The widget
   needs the structured result, so `render_chart` is added to a small keep-list
   (`MCP_STRUCTURED_CONTENT_KEEP_TOOLS`, default `{"render_chart"}`). Every other
   tool is still stripped.
2. **Tool-search transform** hides tools behind `search_tools`/`call_tool`. A UI
   descriptor on a hidden tool won't trigger widget association, so `render_chart`
   and `render_chart_requery` are pinned in `MCP_TOOL_SEARCH_CONFIG.always_visible`.

## Data contract (tool result → widget)

`render_chart` returns Superset's `ChartData` (see `chart/schemas.py`) as the
tool's `structuredContent`, plus a concise text summary for the model.

**Wire shape gotcha:** both tools are typed `-> ChartData | ChartError`, and
FastMCP wraps union returns in a synthetic envelope, so what is actually on the
wire is `{"result": {...ChartData...}}` (the tool's `outputSchema` carries
`x-fastmcp-wrap-result`). The widget unwraps a lone `result` key; the text
content block is *not* wrapped, so the model-facing path is unaffected. `ChartData.explore_url` (new, optional) gives the
widget its "Open in Superset" deep link.

`render_chart_requery` (widget → server, `visibility: ["app"]`) accepts:

```jsonc
{
  "identifier": 42,               // or "chart_id"
  "filter": {"col": "country", "val": "US"},  // click-to-drill (optional; filter_col/filter_val also accepted)
  "time_range": "Last quarter",   // brush-to-zoom (optional)
  "granularity": "P1D"            // finer grain on zoom (optional)
}
```

`granularity` is forwarded as `extra_form_data.time_grain_sqla`, but it is a
best-effort hint rather than a guaranteed re-bucketing operation. Some saved
query contexts—including observed `echarts_timeseries_line` configurations—
ignore the override and return rows at their original grain. Filtering and
`time_range` narrowing still apply; clients must not claim that the returned
data was re-granularized without inspecting it.

All re-query paths go back through `get_chart_data_core`, so the caller's
Chart/dataset RBAC, guest scoping, and RLS are re-applied on every interaction —
the widget cannot exceed the entitlements of the principal who called it.

> [!IMPORTANT]
> MCP Apps hosts commonly cache both `ui://` resources and tool descriptors for
> the lifetime of a client session or conversation. Restarting Superset does
> not invalidate that cache. Bump the versioned chart-viewer URI whenever the
> bundle changes, and verify a new version only from a brand-new client session.

## Build the widget

The built bundle is **not committed** — same convention as
`superset/static/assets` (gitignored in the repo, produced at packaging time,
shipped via `MANIFEST.in`). Until you build it, the `ui://` resource serves a
placeholder page telling you to run the build.

Build it with:

```bash
cd superset/mcp_service/chart/resources/chart_viewer
npm install
npm run build          # emits dist/index.html (self-contained, ~800 KiB)
npm test               # vitest: adapter + bridge contract tests
```

### Known gaps in this setup (PoC-level, must be fixed to graduate)

1. ~~**Nothing runs this in CI.**~~ Fixed: `.github/workflows/mcp-chart-viewer.yml`
   runs `npm ci` / `npm test` / `npm run build` on any change under
   `chart_viewer/`, and fails if `dist/index.html` is not emitted.
2. **Nothing builds it at packaging time — partially fixed.** The PyPI release
   path is wired (`RELEASING/README.md`, "Create the distribution", before
   `python -m build`). The **Docker image is still a gap**: `Dockerfile` has no
   widget build step, so official images serve the placeholder. See
   "Packaging" in `resources/chart_viewer/README.md` for exactly what closing
   it requires.
3. **Location is unusual.** Every other bundler-based npm project in this repo
   is a repo-root sibling (`superset-frontend/`, `superset-websocket/`,
   `superset-embedded-sdk/`, `docs/`). This one lives inside the Python package
   so it sits next to the resource that serves it. If this graduates, moving it
   to a root-level sibling and copying the build output in at package time
   (mirroring `superset/static`) is probably the more conventional shape.

## Test runbook (P4)

### 1. Local — MCP Inspector / MCPJam / ext-apps basic-host
Run the MCP server (streamable-http) and point an MCP Apps-capable inspector at
it. Confirm: `render_chart` appears with `_meta.ui.resourceUri`; calling it
renders the widget; the `ui://superset/chart-viewer/v2` resource loads.

### 2. ChatGPT web — developer mode
Requires an eligible **Business/Enterprise/Edu** workspace. Settings → Connectors
→ Developer mode → add the Superset MCP server (HTTPS). Ask "show me chart 42";
the widget renders inline. (Pro is more limited — see the research doc.)

### 3. Claude — custom connector
Requires a **publicly reachable HTTPS** MCP endpoint (Claude calls from
Anthropic's cloud; localhost won't work). Add it as a custom connector, then ask
Claude to render a chart. **This is the one external dependency for a live demo:
a public Superset MCP staging URL.**

## Security notes

- `render_chart` / `render_chart_requery` are read-only, `class_permission_name="Chart"`.
- No new data path: both delegate to `get_chart_data_core`, which enforces dataset
  access (`validate_chart_dataset`) and guest-token scoping.
- The widget iframe is sandboxed with an empty CSP (`_meta.ui.csp`) — no network
  egress; it talks only to the host over postMessage.
- The bundle is static and tenant-neutral; per-user data flows only through tool
  results, never baked into the `ui://` resource.
- `explore_url` is derived solely from the chart id + configured base URL (no
  secrets/tokens).
