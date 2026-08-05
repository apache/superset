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

"""The MCP Apps extension must be advertised in the initialize response.

Hosts (Claude, ChatGPT) decide whether to render ``ui://`` resources based on
the ``extensions`` map a server returns from ``initialize``. FastMCP's
low-level server adds ``io.modelcontextprotocol/ui`` there as a pydantic extra
field (``ServerCapabilities`` is ``extra="allow"``), so Superset gets the
declaration for free and must NOT duplicate it under the legacy
``experimental`` slot.

That makes the declaration an implicit dependency on the SDK. This test pins
it so an SDK bump that stops advertising the extension fails here rather than
silently degrading every MCP Apps host to a plain-text tool result.
"""

from typing import Any

import pytest
from fastmcp import Client

UI_EXTENSION_ID = "io.modelcontextprotocol/ui"


@pytest.mark.asyncio
async def test_initialize_advertises_mcp_apps_extension():
    from superset.mcp_service.app import mcp

    async with Client(mcp) as client:
        capabilities = client.initialize_result.capabilities

    extras: dict[str, Any] = capabilities.model_extra or {}
    extensions = extras.get("extensions")

    assert isinstance(extensions, dict), (
        "initialize response has no 'extensions' map; MCP Apps hosts will not "
        "render the ui://superset/chart-viewer widget"
    )
    assert UI_EXTENSION_ID in extensions, (
        f"initialize response does not advertise {UI_EXTENSION_ID}; "
        f"advertised extensions: {sorted(extensions)}"
    )


@pytest.mark.asyncio
async def test_ui_extension_is_not_duplicated_under_experimental():
    """``experimental`` is the legacy slot and must not mirror ``extensions``.

    Declaring the same extension in both places gives hosts two sources of
    truth for one capability. The real ``extensions`` field already carries it.
    """
    from superset.mcp_service.app import mcp

    async with Client(mcp) as client:
        experimental = client.initialize_result.capabilities.experimental or {}

    assert UI_EXTENSION_ID not in experimental
