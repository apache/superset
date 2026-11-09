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
"""Workspace URLs for authorized canvases returned by MCP tools."""

from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.models.canvas import Canvas


def canvas_url(canvas: Canvas, draft_token: str | None = None) -> str:
    """Preserve the configured deployment prefix and the canvas's canonical route."""
    url = f"{get_superset_base_url()}{canvas.url}"
    return f"{url}#draft={draft_token}" if draft_token else url
