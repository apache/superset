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

"""Tests for BrowserHelloMiddleware path scoping.

The hello page must only answer browser navigations to the MCP endpoint.
Other routes on the same app -- notably the browser-facing OAuth routes of
an ``MCP_AUTH_FACTORY`` OAuth-proxy provider -- must reach their handlers.
"""

import pytest
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.requests import Request
from starlette.responses import PlainTextResponse, Response
from starlette.routing import Route
from starlette.testclient import TestClient

from superset.mcp_service.jwt_verifier import BrowserHelloMiddleware

BROWSER_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
HELLO_MARKER = b"mcpServers"

PASSTHROUGH_PATHS = [
    "/authorize",
    "/consent",
    "/auth/callback",
    "/.well-known/oauth-authorization-server",
    "/.well-known/oauth-protected-resource/mcp",
    "/health",
    "/",
]


async def _mcp_endpoint(request: Request) -> Response:
    # FastMCP's streamable-HTTP endpoint only accepts POST.
    return PlainTextResponse("mcp endpoint", status_code=405)


async def _route(request: Request) -> Response:
    return PlainTextResponse(f"route {request.url.path}")


def _client(**middleware_kwargs: object) -> TestClient:
    mcp_path = str(middleware_kwargs.get("mcp_path") or "/mcp")
    routes = [Route(mcp_path, _mcp_endpoint, methods=["GET", "POST"])] + [
        Route(path, _route, methods=["GET", "HEAD"]) for path in PASSTHROUGH_PATHS
    ]
    app = Starlette(
        routes=routes,
        middleware=[
            Middleware(BrowserHelloMiddleware, auth_enabled=True, **middleware_kwargs)
        ],
    )
    return TestClient(app)


def test_browser_get_on_mcp_endpoint_returns_hello_page() -> None:
    response = _client().get("/mcp", headers={"accept": BROWSER_ACCEPT})
    assert response.status_code == 200
    assert HELLO_MARKER in response.content


def test_browser_get_on_mcp_endpoint_with_trailing_slash_returns_hello_page() -> None:
    response = _client().get(
        "/mcp/", headers={"accept": BROWSER_ACCEPT}, follow_redirects=False
    )
    assert response.status_code == 200
    assert HELLO_MARKER in response.content


def test_browser_head_on_mcp_endpoint_returns_hello_page() -> None:
    response = _client().head("/mcp", headers={"accept": BROWSER_ACCEPT})
    assert response.status_code == 200


@pytest.mark.parametrize("path", PASSTHROUGH_PATHS)
def test_browser_get_on_other_routes_passes_through(path: str) -> None:
    response = _client().get(path, headers={"accept": BROWSER_ACCEPT})
    assert response.status_code == 200
    assert response.text == f"route {path}"
    assert HELLO_MARKER not in response.content


@pytest.mark.parametrize("accept", ["application/json", "text/event-stream", ""])
def test_non_browser_get_on_mcp_endpoint_passes_through(accept: str) -> None:
    headers = {"accept": accept} if accept else {}
    response = _client().get("/mcp", headers=headers)
    assert response.status_code == 405
    assert response.text == "mcp endpoint"


def test_custom_mcp_path_is_respected() -> None:
    client = _client(mcp_path="/custom-mcp")
    assert (
        HELLO_MARKER
        in client.get("/custom-mcp", headers={"accept": BROWSER_ACCEPT}).content
    )
    response = client.get("/authorize", headers={"accept": BROWSER_ACCEPT})
    assert response.text == "route /authorize"


def test_default_mcp_path_follows_fastmcp_settings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import fastmcp

    monkeypatch.setattr(fastmcp.settings, "streamable_http_path", "/custom-mcp")
    routes = [
        Route("/custom-mcp", _mcp_endpoint, methods=["GET"]),
        Route("/mcp", _route, methods=["GET"]),
    ]
    app = Starlette(routes=routes, middleware=[Middleware(BrowserHelloMiddleware)])
    client = TestClient(app)
    assert (
        HELLO_MARKER
        in client.get("/custom-mcp", headers={"accept": BROWSER_ACCEPT}).content
    )
    assert client.get("/mcp", headers={"accept": BROWSER_ACCEPT}).text == "route /mcp"
