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

"""
MCP Apps UI resource: the Superset chart-viewer widget.

Serves the self-contained HTML bundle (built from
``chart_viewer/`` via Vite + vite-plugin-singlefile) at
``ui://superset/chart-viewer/v2``. MCP Apps hosts fetch this resource and render
it in a sandboxed iframe to display ``render_chart`` results as interactive
charts.

The bundle is fully inlined (all JS/CSS), so the resource needs no external
network access — the declared CSP (see ``render_chart``'s ``_meta.ui.csp``)
blocks egress and the widget talks to the host only over the postMessage bridge.
"""

import logging
from functools import lru_cache
from pathlib import Path

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook

logger = logging.getLogger(__name__)

CHART_VIEWER_URI = "ui://superset/chart-viewer/v2"
CHART_VIEWER_MIME_TYPE = "text/html;profile=mcp-app"

# Built single-file bundle: chart_viewer/dist/index.html (produced by
# ``npm run build`` in the chart_viewer directory).
_BUNDLE_PATH = Path(__file__).parent / "chart_viewer" / "dist" / "index.html"

# Shown when the bundle has not been built yet (e.g. a source checkout without
# a frontend build). Keeps the resource well-formed so hosts render *something*
# instead of failing, and tells the operator how to fix it.
_FALLBACK_HTML = """<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Superset chart viewer</title>
<style>
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    sans-serif; margin: 0; padding: 24px; color: #1b2733;
    background: #f7f8fa; }
  .card { max-width: 520px; margin: 8px auto; background: #fff; border:
    1px solid #e0e0e0; border-radius: 8px; padding: 20px 24px; }
  h1 { font-size: 15px; margin: 0 0 8px; color: #20A7C9; }
  code { background: #f0f2f5; padding: 1px 5px; border-radius: 4px; }
</style></head>
<body><div class="card">
  <h1>Chart viewer not built</h1>
  <p>The Superset chart-viewer widget bundle is missing. Build it with:</p>
  <p><code>cd superset/mcp_service/chart/resources/chart_viewer &amp;&amp;
     npm install &amp;&amp; npm run build</code></p>
  <p>The tool result's data is still available to the model as structured
     content and a text summary.</p>
</div></body></html>
"""


@lru_cache(maxsize=1)
def _load_bundle() -> str:
    """Read the built widget HTML once and cache it. Falls back to a helpful
    placeholder page when the bundle has not been built."""
    try:
        html = _BUNDLE_PATH.read_text(encoding="utf-8")
        if html.strip():
            return html
        logger.warning("Chart-viewer bundle at %s is empty", _BUNDLE_PATH)
    except FileNotFoundError:
        logger.warning(
            "Chart-viewer bundle not found at %s — serving fallback. "
            "Build it with `npm run build` in the chart_viewer directory.",
            _BUNDLE_PATH,
        )
    except OSError as exc:  # pragma: no cover - defensive
        logger.warning("Failed to read chart-viewer bundle: %s", exc)
    return _FALLBACK_HTML


@mcp.resource(
    CHART_VIEWER_URI,
    name="Superset chart viewer",
    description=(
        "Interactive chart-viewer widget rendered by MCP Apps hosts for "
        "render_chart results."
    ),
    mime_type=CHART_VIEWER_MIME_TYPE,
    meta={
        "ui": {
            "csp": {
                "connectDomains": [],
                "resourceDomains": [],
                "frameDomains": [],
                "baseUriDomains": [],
            }
        }
    },
)
@mcp_auth_hook
def get_chart_viewer_resource() -> str:
    """Return the self-contained HTML for the Superset chart-viewer MCP App."""
    return _load_bundle()
