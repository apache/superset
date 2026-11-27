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

"""A tool call whose user cannot be resolved reports why.

``get_user_from_request`` fails closed with messages Superset writes about the
caller's credentials. They reach the client through the middleware's
``ValueError`` branch, which keeps them for a signed-in principal and gives an
embedded guest the generic message.
"""

import sys
from collections.abc import Iterator
from contextlib import ExitStack
from types import SimpleNamespace
from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client
from flask import Flask

from superset.mcp_service import auth
from superset.mcp_service.app import mcp
from superset.mcp_service.guest_token_verifier import GUEST_TOKEN_CLAIM
from superset.mcp_service.utils.tool_errors import UNEXPECTED_ERROR_MESSAGE
from superset.utils.error_sanitization import GENERIC_ERROR_MESSAGE


@pytest.fixture
def production_middleware() -> Iterator[None]:
    """Install the middleware stack the server runs, around the shared app."""
    from superset.mcp_service.server import build_middleware_list

    original_middleware = list(mcp.middleware)
    for middleware in build_middleware_list():
        mcp.add_middleware(middleware)
    try:
        yield
    finally:
        mcp.middleware[:] = original_middleware


@pytest.fixture
def tool_app() -> Flask:
    """The Flask app the tool call resolves its user in."""
    from superset.mcp_service.flask_singleton import get_flask_app

    return get_flask_app()


def _token(claims: dict[str, Any], client_id: str | None = None) -> Any:
    return SimpleNamespace(
        token="header.payload.signature",  # noqa: S106 - not a credential
        claims=claims,
        client_id=client_id,
    )


def _no_auth_source(stack: ExitStack, app: Flask) -> None:
    stack.enter_context(patch.dict(app.config, {"MCP_DEV_USERNAME": None}))


def _dev_user_not_found(stack: ExitStack, app: Flask) -> None:
    stack.enter_context(patch.dict(app.config, {"MCP_DEV_USERNAME": "ghost"}))
    stack.enter_context(
        patch(
            "superset.mcp_service.auth.load_user_with_relationships",
            return_value=None,
        )
    )


def _disabled_account(stack: ExitStack, app: Flask) -> None:
    stack.enter_context(patch.dict(app.config, {"MCP_DEV_USERNAME": "alice"}))
    user = Mock(username="alice", is_active=False, roles=[], groups=[])
    stack.enter_context(
        patch(
            "superset.mcp_service.auth.load_user_with_relationships",
            return_value=user,
        )
    )


def _jwt(claims: dict[str, Any], client_id: str | None = None):
    def setup(stack: ExitStack, app: Flask) -> None:
        import fastmcp.server.dependencies as dependencies

        original = dependencies.get_access_token
        token = _token(claims, client_id)

        def get_access_token() -> Any:
            # Only the user resolution sees the token; the client session
            # FastMCP opens for the test keeps its own (absent) one.
            if sys._getframe(1).f_globals.get("__name__") == auth.__name__:
                return token
            return original()

        stack.enter_context(
            patch.object(dependencies, "get_access_token", get_access_token)
        )
        stack.enter_context(
            patch(
                "superset.mcp_service.auth.load_user_with_relationships",
                return_value=None,
            )
        )

    return setup


def _multi_issuer(stack: ExitStack, app: Flask) -> None:
    _jwt({"sub": "alice"})(stack, app)
    stack.enter_context(
        patch.dict(
            app.config,
            {"MCP_JWT_ISSUER": ["https://a.example", "https://b.example"]},
        )
    )
    stack.enter_context(patch.dict(app.config, {"MCP_USER_RESOLVER": None}))


def _guest_auth_disabled(stack: ExitStack, app: Flask) -> None:
    _jwt({GUEST_TOKEN_CLAIM: True}, client_id="guest")(stack, app)
    stack.enter_context(
        patch.dict(app.config, {"MCP_EMBEDDED_GUEST_AUTH_ENABLED": False})
    )


def _invalid_guest_token(stack: ExitStack, app: Flask) -> None:
    _jwt({GUEST_TOKEN_CLAIM: True}, client_id="guest")(stack, app)
    stack.enter_context(
        patch.dict(app.config, {"MCP_EMBEDDED_GUEST_AUTH_ENABLED": True})
    )
    stack.enter_context(
        patch(
            "superset.mcp_service.auth.is_feature_enabled",
            side_effect=lambda flag: flag == "EMBEDDED_SUPERSET",
        )
    )
    stack.enter_context(
        patch(
            "superset.mcp_service.auth.security_manager.parse_jwt_guest_token",
            side_effect=ValueError("bad signature"),
        )
    )


_CASES = [
    pytest.param(
        _no_auth_source,
        "Authentication required. No valid credentials provided.",
        id="no-auth-source",
    ),
    pytest.param(
        _dev_user_not_found,
        "User 'ghost' not found. Please create admin user with: "
        "superset fab create-admin",
        id="dev-user-not-found",
    ),
    pytest.param(
        _disabled_account,
        "Account for user 'alice' is disabled.",
        id="account-disabled",
    ),
    pytest.param(
        _jwt({}),
        "JWT context present but no username could be extracted from claims",
        id="jwt-no-username",
    ),
    pytest.param(
        _jwt({"sub": "ghost"}),
        "JWT authenticated user not found in Superset database. "
        "Ensure the user exists before granting MCP access.",
        id="jwt-user-not-found",
    ),
    pytest.param(
        _multi_issuer,
        "MCP_JWT_ISSUER trusts multiple issuers but no MCP_USER_RESOLVER "
        "is configured.",
        id="multi-issuer-without-resolver",
    ),
    pytest.param(
        _guest_auth_disabled,
        # The middleware's secret redaction rewrites "token presented", as
        # it did on the base branch.
        "Guest-marked Token: [REDACTED] but embedded guest auth is not enabled",
        id="guest-auth-disabled",
    ),
    pytest.param(
        _invalid_guest_token,
        "Guest-marked Token: [REDACTED] not a valid guest token",
        id="invalid-guest-token",
    ),
]


@pytest.mark.parametrize(("setup", "guidance"), _CASES)
@pytest.mark.parametrize("guest", [False, True], ids=["signed-in", "guest"])
@pytest.mark.asyncio
async def test_credential_failure_guidance_reaches_caller(
    production_middleware: None,
    tool_app: Flask,
    setup: Any,
    guidance: str,
    guest: bool,
) -> None:
    """Each fail-closed credential message is kept for a signed-in principal."""
    with ExitStack() as stack:
        setup(stack, tool_app)
        stack.enter_context(
            patch(
                "superset.utils.error_sanitization.is_sanitization_required",
                return_value=guest,
            )
        )
        dao_list = stack.enter_context(patch("superset.daos.chart.ChartDAO.list"))
        async with Client(mcp) as client:
            result = await client.call_tool(
                "list_charts", {"request": {}}, raise_on_error=False
            )

    dao_list.assert_not_called()
    assert result.is_error
    response = result.content[0].text
    assert "list_charts" in response
    if guest:
        assert guidance not in response
        assert str(GENERIC_ERROR_MESSAGE) in response
    else:
        assert guidance in response
        assert UNEXPECTED_ERROR_MESSAGE not in response
