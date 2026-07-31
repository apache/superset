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

"""Shared chart-module constants.

Kept dependency-light so both the ``ui://`` resource (which imports the FastMCP
app) and the tools (which must not) can depend on it without creating an import
cycle.
"""

import hashlib
from pathlib import Path

# Schema version of the widget contract. Bump only for a change hosts should
# treat as a different app, not for ordinary bundle edits — those are covered
# by the content digest appended below.
CHART_VIEWER_SCHEMA_VERSION = "v4"

_BUNDLE_PATH = (
    Path(__file__).parent / "resources" / "chart_viewer" / "dist" / "index.html"
)


def _chart_viewer_version() -> str:
    """Version segment of the chart-viewer URI, content-addressed by bundle.

    MCP Apps hosts cache a ``ui://`` resource by URI and do not re-fetch it —
    restarting Superset does not invalidate it. Deriving the version from a
    digest of the built bundle means any rebuild publishes under a new URI and
    hosts pick it up on their own. Hand-bumping a literal was the alternative,
    and forgetting the bump made corrected code look broken twice.

    Falls back to the bare schema version when the bundle has not been built,
    which keeps a source checkout (and the placeholder page the resource serves
    in that case) working.
    """
    try:
        digest = hashlib.sha256(_BUNDLE_PATH.read_bytes()).hexdigest()[:12]
    except OSError:
        return CHART_VIEWER_SCHEMA_VERSION
    return f"{CHART_VIEWER_SCHEMA_VERSION}-{digest}"


# Versioned URI of the MCP Apps chart-viewer resource.
#
# Single source of truth: the resource that serves the bundle
# (``chart/resources/chart_viewer.py``) and the tool descriptors that point at
# it (``chart/tool/render_chart.py``) both import this. They were separate
# constants once, which meant a bump could be applied to one and not the other.
CHART_VIEWER_URI = f"ui://superset/chart-viewer/{_chart_viewer_version()}"

# MIME type the MCP Apps spec defines for an HTML app resource.
CHART_VIEWER_MIME_TYPE = "text/html;profile=mcp-app"
