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

"""The server advertises the MCP Apps extension in its capabilities.

The MCP Apps spec asks hosts to advertise ``io.modelcontextprotocol/ui`` and
servers to check it; FastMCP also advertises it on the server's side, in
``capabilities.extensions``, and Superset gets that declaration for free. It
must NOT be duplicated under the legacy ``experimental`` slot.

The MCP SDK sends ``capabilities.extensions`` only in protocol eras that
define it: a client negotiating with ``server/discover`` sees it, while the
``initialize`` handshake of earlier eras drops the field. This test pins the
declaration where the SDK sends it, so an SDK bump that stops advertising the
extension fails here.
"""

import pytest
from fastmcp import Client

UI_EXTENSION_ID = "io.modelcontextprotocol/ui"


@pytest.mark.asyncio
async def test_server_capabilities_advertise_mcp_apps_extension():
    from superset.mcp_service.app import mcp

    async with Client(mcp) as client:
        capabilities = client.server_capabilities

    assert capabilities is not None
    extensions = capabilities.extensions
    assert isinstance(extensions, dict), (
        "server capabilities have no 'extensions' map; advertised: "
        f"{capabilities.model_dump(exclude_none=True)}"
    )
    assert UI_EXTENSION_ID in extensions, (
        f"server capabilities do not advertise {UI_EXTENSION_ID}; "
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
        capabilities = client.server_capabilities

    assert capabilities is not None
    experimental = capabilities.experimental or {}

    assert UI_EXTENSION_ID not in experimental
