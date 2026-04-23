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
MCP Apps ``ui://`` resource: ``ui://superset/chart-viewer``.

When the ``show_chart`` tool result is delivered alongside this resource via
the MCP Apps extension, hosts (Claude Desktop, MCP Inspector, etc.) render
the returned HTML inside a sandboxed iframe and pass the tool's structured
payload via postMessage. The HTML mounts a live <iframe> pointing at the
Superset standalone Explore page with a short-lived guest token.

See: https://modelcontextprotocol.io/extensions/apps/overview
"""

import logging

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook

logger = logging.getLogger(__name__)


_CHART_VIEWER_HTML = """<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Superset chart</title>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #f7f7f9; }
    #root { height: 100vh; width: 100%; display: flex; flex-direction: column; }
    #header {
      padding: 8px 12px;
      font: 13px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        sans-serif;
      color: #333;
      background: #fff;
      border-bottom: 1px solid #e5e7eb;
      display: flex; align-items: center; justify-content: space-between;
    }
    #header .title { font-weight: 600; }
    #header .meta { color: #6b7280; font-size: 12px; }
    #frame-wrap { flex: 1; position: relative; }
    iframe { border: 0; width: 100%; height: 100%; display: block; }
    #placeholder {
      position: absolute; inset: 0; display: flex; align-items: center;
      justify-content: center; color: #6b7280;
      font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .err { color: #b91c1c; }
  </style>
</head>
<body>
  <div id="root">
    <div id="header">
      <div class="title" id="title">Superset chart</div>
      <div class="meta" id="meta"></div>
    </div>
    <div id="frame-wrap">
      <div id="placeholder">Waiting for chart data...</div>
    </div>
  </div>

  <script>
    // Minimal MCP Apps bridge: the host posts { type: "tool_result", result }
    // after the tool call returns. We pluck explore_url out of structured
    // content and mount the iframe.
    (function () {
      const wrap = document.getElementById("frame-wrap");
      const titleEl = document.getElementById("title");
      const metaEl = document.getElementById("meta");

      function mount(data) {
        if (!data) return;
        const url = data.explore_url;
        if (!url) {
          wrap.innerHTML =
            '<div id="placeholder" class="err">' +
            (data.error || "No explore_url returned") +
            "</div>";
          return;
        }
        if (data.chart_name) titleEl.textContent = data.chart_name;
        const parts = [];
        if (data.viz_type) parts.push(data.viz_type);
        if (data.chart_id) parts.push("id: " + data.chart_id);
        metaEl.textContent = parts.join(" · ");

        const iframe = document.createElement("iframe");
        iframe.src = url;
        iframe.setAttribute(
          "sandbox",
          "allow-scripts allow-same-origin allow-forms allow-popups"
        );
        iframe.setAttribute("allow", "clipboard-write; fullscreen");
        iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
        wrap.replaceChildren(iframe);
      }

      function extractResult(msg) {
        if (!msg || typeof msg !== "object") return null;
        // Accept a few shapes we've seen in MCP App bridges.
        if (msg.structuredContent) return msg.structuredContent;
        if (msg.result && msg.result.structuredContent)
          return msg.result.structuredContent;
        if (msg.params && msg.params.structuredContent)
          return msg.params.structuredContent;
        if (msg.explore_url) return msg; // already unwrapped
        if (msg.result && msg.result.explore_url) return msg.result;
        return null;
      }

      window.addEventListener("message", function (event) {
        const payload = extractResult(event.data);
        if (payload) mount(payload);
      });

      // Ask the host for the payload in case the initial message predated
      // this listener (JSON-RPC shape used by MCP Apps).
      try {
        window.parent &&
          window.parent.postMessage(
            { jsonrpc: "2.0", id: 1, method: "ui/getToolResult" },
            "*"
          );
      } catch (e) {
        // No parent or blocked — wait for an inbound message.
      }
    })();
  </script>
</body>
</html>
"""


@mcp.resource(
    "ui://superset/chart-viewer",
    mime_type="text/html",
    name="Superset chart viewer",
    description=(
        "MCP Apps UI resource that renders a saved Superset chart inline. "
        "Consumed by tools that declare `_meta.ui.resourceUri` = "
        "`ui://superset/chart-viewer` (e.g. `show_chart`)."
    ),
)
@mcp_auth_hook
def chart_viewer_resource() -> str:
    """Return the HTML document that boots the inline chart viewer."""
    return _CHART_VIEWER_HTML
