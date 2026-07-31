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

Deliberately import-free so both the ``ui://`` resource (which imports the
FastMCP app) and the tools (which must not) can depend on it without creating
an import cycle.
"""

# Versioned URI of the MCP Apps chart-viewer resource.
#
# MCP Apps hosts cache a ``ui://`` resource per conversation and never re-fetch
# it for that conversation — restarting Superset does not invalidate it. Bumping
# this version is the only reliable way to force hosts to pick up a rebuilt
# bundle, so **bump it whenever the widget's behaviour changes** in a way
# testers need to see.
#
# This is the single source of truth: the resource that serves the bundle
# (``chart/resources/chart_viewer.py``) and the tool descriptors that point at
# it (``chart/tool/render_chart.py``) both import it. They were separate
# constants once, which meant a bump could be applied to one and not the other.
CHART_VIEWER_URI = "ui://superset/chart-viewer/v3"

# MIME type the MCP Apps spec defines for an HTML app resource.
CHART_VIEWER_MIME_TYPE = "text/html;profile=mcp-app"
