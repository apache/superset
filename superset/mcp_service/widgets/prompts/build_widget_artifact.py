# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

"""MCP prompt: build_widget_artifact"""

from __future__ import annotations

from flask import current_app
from superset_core.mcp.decorators import prompt

from superset.mcp_service import mcp_config

STRATEGY_TOOLS: dict[str, list[str]] = {
    "widget-tools": ["get_widget_data", "get_widget_values", "get_saved_widget"],
    "query-dataset": ["query_dataset"],
}
ARTIFACT_KINDS = ("react", "html")

_LOADER = """function loadSupersetWidgets(url) {
  if (window.SupersetWidgets) return Promise.resolve(window.SupersetWidgets);
  return new Promise((resolve, reject) => {
    const script = Object.assign(document.createElement("script"), { src: url });
    script.onload = () => resolve(window.SupersetWidgets);
    script.onerror = () => reject(new Error(`Could not load ${url}`));
    document.head.appendChild(script);
  });
}"""

_REACT_EXAMPLE = """import { useEffect, useRef, useState } from "react";

const WIDGETS_URL = "__BUNDLE_URL__";

__LOADER__

export default function App() {
  const chartRef = useRef(null);
  const sessionRef = useRef(null);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadSupersetWidgets(WIDGETS_URL)
      .then(async (W) => {
        const mcp = window.claude?.use ? await window.claude.use("mcp") : null;
        if (cancelled) return;
        if (!mcp) {
          setProblem("Publish this artifact and add the __SERVER__ connector.");
          return;
        }
        const session = W.createSession({
          server: "__SERVER__",
          strategy: "__STRATEGY__",
          mcp,
        });
        sessionRef.current = session;
        session.mount(chartRef.current, __CHART_SPEC__, {
          instanceId: "main-chart",
        });
      })
      .catch((error) => !cancelled && setProblem(error.message));
    return () => {
      cancelled = true;
      sessionRef.current?.dispose();
    };
  }, []);

  return (
    <div>
      {problem && <p role="alert">{problem}</p>}
      {/* The bundle owns this element: never render children into it. */}
      <div ref={chartRef} style={{ height: 360 }} />
    </div>
  );
}"""

_HTML_EXAMPLE = """<div id="chart" style="height: 360px"></div>
<script src="__BUNDLE_URL__"></script>
<script>
  const session = window.SupersetWidgets.createSession({
    server: "__SERVER__",
    strategy: "__STRATEGY__",
  });
  session.mount(document.getElementById("chart"), __CHART_SPEC__, {
    instanceId: "main-chart",
  });
</script>"""

_CHART_SPEC = """{
          type: "echarts",
          props: {
            chartType: "bar",
            crossFilter: true,
            dataBinding: {
              datasetId: <id>,
              metrics: ["<saved metric>"],
              dimensions: ["<column>"],
              rowLimit: 10,
            },
            echartsOptions: {
              xAxis: {
                type: "category",
                data: { $bind: { source: "dimension", alias: "<column>" } },
              },
              yAxis: { type: "value" },
            },
            chrome: { titleText: "<title>" },
          },
        }"""


def get_widgets_bundle_url() -> str | None:
    """The published widgets bundle URL from app config, if any."""
    try:
        return current_app.config.get(
            "MCP_WIDGETS_BUNDLE_URL", mcp_config.MCP_WIDGETS_BUNDLE_URL
        )
    except RuntimeError:
        # Outside of a Flask application context
        return mcp_config.MCP_WIDGETS_BUNDLE_URL


def render_widget_artifact_guide(
    bundle_url: str | None,
    connector_name: str = "Superset",
    strategy: str = "widget-tools",
    artifact_kind: str = "react",
) -> str:
    """Build the model-facing guide; unknown options fall back to defaults."""
    if strategy not in STRATEGY_TOOLS:
        strategy = "widget-tools"
    if artifact_kind not in ARTIFACT_KINDS:
        artifact_kind = "react"
    tools = STRATEGY_TOOLS[strategy]

    if bundle_url:
        bundle_section = (
            f"Load the bundle from `{bundle_url}`. Artifacts cannot install npm "
            "packages or import the widgets any other way."
        )
    else:
        bundle_section = (
            "This Superset has no widgets bundle URL configured "
            "(`MCP_WIDGETS_BUNDLE_URL`). Before writing the page, ask the user for "
            "the URL of the published `@apache-superset/widgets` bundle "
            "(`superset-widgets.min.js` on a CDN the artifact host allows). Do not "
            "guess a URL and do not try to inline the bundle yourself."
        )

    example = _REACT_EXAMPLE if artifact_kind == "react" else _HTML_EXAMPLE
    example = (
        example.replace("__LOADER__", _LOADER)
        .replace("__CHART_SPEC__", _CHART_SPEC)
        .replace("__BUNDLE_URL__", bundle_url or "<WIDGETS_BUNDLE_URL>")
        .replace("__SERVER__", connector_name)
        .replace("__STRATEGY__", strategy)
    )
    fence = "jsx" if artifact_kind == "react" else "html"

    if strategy == "query-dataset":
        strategy_notes = (
            "- Strategy `query-dataset` runs inline widgets through `query_dataset`: "
            "saved metric names only (no adhoc metrics), SIMPLE filters only, no "
            "saved widgets (`{id}`). Switch to `widget-tools` if the server has "
            "`get_widget_data`."
        )
    else:
        strategy_notes = (
            "- Strategy `widget-tools` supports every inline widget and saved "
            'widgets: `session.mount(element, { id: "<uuid>" })`. Look a saved '
            "widget up with `get_saved_widget` only when the user gives its uuid."
        )

    tool_list = ", ".join(f'"{name}"' for name in tools)

    return f"""# Build a backend-less app with {connector_name} widgets

Render real {connector_name} widgets (charts, metric tiles, tables, filters,
markdown) in a Claude artifact. The page has no backend: data comes from the
viewer's own "{connector_name}" connector, with their permissions and row-level
security. Never ask for, embed or invent credentials or tokens, and never call
`fetch()` — artifacts block it.

## 1. Find the data (use the tools now, before writing code)
- `list_datasets`, then `get_dataset_info` for the chosen dataset: copy its id,
  column names and saved metric names exactly.
- Never invent dataset ids, column or metric names, or widget uuids.

## 2. Load the widgets bundle
{bundle_section}

```js
{_LOADER}
```

## 3. Mount widgets with a session
```js
const session = SupersetWidgets.createSession({{
  server: "{connector_name}",   // connector display name
  strategy: "{strategy}",
  mcp,                          // optional: await window.claude.use("mcp")
}});
// widget.unmount() removes one widget
const widget = session.mount(element, {{ type, props }}, {{ instanceId }});
// null clears the filter
session.setFilter("state", {{
  datasetId, column: "state", operator: "IN", value: ["CA"],
}});
const off = session.on("valueChanged", (event) => event.payload.resolved);
session.setThemeMode("dark");
session.dispose(); // on unmount / cleanup
```
- One session per page: its widgets share one bus and cross-filter.
- The artifact keeps its own React. Give each widget an empty element (a ref)
  and never render children into it; the bundle brings its own React.
- Filter operators: EQUALS, NOT_EQUALS, IN, NOT_IN, RANGE (`{{min, max}}`),
  TIME_RANGE (`{{start, end}}`).
{strategy_notes}

## 4. Widget specs (`{{ type, props }}`)
- `echarts`: `chartType` "bar" | "line" | "scatter", `dataBinding: {{ datasetId,
  metrics, dimensions, rowLimit }}`, and `echartsOptions` whose category axis is
  bound: `xAxis: {{ type: "category", data: {{ $bind: {{ source: "dimension",
  alias: "<column>" }} }} }}`. Optional `chrome: {{ titleText }}`,
  `crossFilter: true`. For a pie, omit `chartType` and set
  `series: [{{ type: "pie", data: {{ $bind: {{ source: "records", fields: {{ name:
  "<column>", value: "<metric>" }} }} }} }}]`.
- `metric-tile`: `dataBinding: {{ datasetId, metrics: ["<metric>"] }}`, `label`.
- `filter.select`: `datasetId`, `column`; its selection filters every widget
  on the same dataset.
- `ag-grid-table`: `dataBinding: {{ datasetId, metrics, dimensions, rowLimit }}`.
- `markdown`: `content`.

## 5. Example ({artifact_kind} artifact)
```{fence}
{example}
```

## 6. Publish
Publish with this capabilities manifest (list only the tools the page calls):
```json
{{"mcp": {{"servers": [{{"server": "{connector_name}", "tools": [{tool_list}]}}]}}}}
```
MCP-backed artifacts cannot be shared publicly; each viewer needs the connector.

## 7. Failures
Widgets show their own error messages. For page-level state:
- `window.claude.use("mcp")` resolves `null`: not a published artifact or no
  connector access here; explain, do not retry.
- `needs_reauth`: ask the viewer to reconnect the connector.
- `server_not_connected` / `server_not_found`: ask them to add it.
- `approval_required` / `not_granted`: ask them to approve access.
- `not_in_manifest`: republish with the tool in the manifest.
- `forbidden`: the viewer's account cannot read that data.
- `invalid_widget`: fix the spec with names from `get_dataset_info`.
- `unsupported`: the strategy cannot serve that widget.
- `server_unavailable`: offer a retry button; never retry in a loop.
"""


@prompt("build_widget_artifact")
async def build_widget_artifact_prompt(
    connector_name: str = "Superset",
    strategy: str = "widget-tools",
    artifact_kind: str = "react",
) -> str:
    """
    Guide for building a backend-less app (e.g. a Claude artifact) that renders
    Superset widgets through the viewer's Superset connector.

    Args:
        connector_name: The Superset connector's display name in Claude settings
        strategy: widget-tools (widget MCP tools) or query-dataset (query_dataset)
        artifact_kind: react or html
    """
    return render_widget_artifact_guide(
        get_widgets_bundle_url(), connector_name, strategy, artifact_kind
    )
