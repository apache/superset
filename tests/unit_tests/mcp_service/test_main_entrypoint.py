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
"""Tests for the ``python -m superset.mcp_service`` entrypoint's non-stdio path.

Network transports (streamable-http, sse, ...) must install the same auth
provider as the supported CLI path (``superset mcp run`` -> server.run_server()
-> _create_auth_provider()) instead of starting with no verifier at all.
"""

from unittest.mock import MagicMock, patch

import pytest


def test_main_installs_auth_provider_for_network_transport(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The non-stdio branch must call _create_auth_provider and pass its
    result into init_fastmcp_server, mirroring run_server()."""
    monkeypatch.setenv("FASTMCP_TRANSPORT", "sse")

    from superset.mcp_service import __main__ as main_module

    flask_app = MagicMock()
    auth_provider = object()
    mcp_instance = MagicMock()

    with (
        patch(
            "superset.mcp_service.flask_singleton.get_flask_app",
            return_value=flask_app,
        ),
        patch(
            "superset.mcp_service.server._create_auth_provider",
            return_value=auth_provider,
        ) as mock_create_auth_provider,
        patch.object(
            main_module, "init_fastmcp_server", return_value=mcp_instance
        ) as mock_init,
        patch.object(main_module, "_add_default_middlewares"),
        patch.object(main_module.mcp, "run") as mock_run,
    ):
        main_module.main()

    mock_create_auth_provider.assert_called_once_with(flask_app)
    mock_init.assert_called_once_with(auth=auth_provider)
    mock_run.assert_called_once_with(transport="sse")


def test_main_propagates_auth_config_error_for_network_transport(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A verifier-construction failure must abort startup, not fall through to
    an unauthenticated server.

    Before the fix, the non-stdio branch never called _create_auth_provider
    at all, so MCP_AUTH_ENABLED was silently discarded by this entrypoint.
    """
    monkeypatch.setenv("FASTMCP_TRANSPORT", "streamable-http")

    from superset.mcp_service import __main__ as main_module
    from superset.mcp_service.mcp_config import MCPAuthConfigError

    flask_app = MagicMock()

    with (
        patch(
            "superset.mcp_service.flask_singleton.get_flask_app",
            return_value=flask_app,
        ),
        patch(
            "superset.mcp_service.server._create_auth_provider",
            side_effect=MCPAuthConfigError("bad auth config"),
        ),
        patch.object(main_module, "init_fastmcp_server") as mock_init,
        patch.object(main_module, "_add_default_middlewares"),
        patch.object(main_module.mcp, "run") as mock_run,
    ):
        with pytest.raises(MCPAuthConfigError):
            main_module.main()

    mock_init.assert_not_called()
    mock_run.assert_not_called()


def test_add_default_middlewares_installs_response_caching() -> None:
    """``_add_default_middlewares`` must install response caching when
    configured, matching ``run_server()``'s default (non-factory) path --
    otherwise MCP_CACHE_CONFIG has no effect for this entrypoint's transports.
    """
    from superset.mcp_service import __main__ as main_module

    caching_middleware = object()

    with (
        patch.object(main_module, "build_middleware_list", return_value=[]),
        patch.object(
            main_module, "create_response_size_guard_middleware", return_value=None
        ),
        patch.object(
            main_module,
            "create_response_caching_middleware",
            return_value=caching_middleware,
        ),
        patch.object(main_module.mcp, "add_middleware") as mock_add_middleware,
    ):
        main_module._add_default_middlewares()

    mock_add_middleware.assert_called_once_with(caching_middleware)
