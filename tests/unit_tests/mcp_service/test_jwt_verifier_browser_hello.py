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

"""Tests for browser-friendly hello page in _auth_error_handler."""

from unittest.mock import MagicMock

from starlette.authentication import AuthenticationError
from starlette.responses import HTMLResponse, JSONResponse

from superset.mcp_service.jwt_verifier import _auth_error_handler


def _make_conn(accept: str, method: str = "GET") -> MagicMock:
    conn = MagicMock()
    conn.headers = {"accept": accept} if accept else {}
    conn.scope = {"method": method}
    return conn


def test_browser_accept_returns_html_200() -> None:
    conn = _make_conn("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
    exc = AuthenticationError("no token")
    response = _auth_error_handler(conn, exc)
    assert isinstance(response, HTMLResponse)
    assert response.status_code == 200
    assert b"MCP" in response.body
    assert b"mcpServers" in response.body


def test_browser_accept_html_only_returns_200() -> None:
    conn = _make_conn("text/html")
    exc = AuthenticationError("no token")
    response = _auth_error_handler(conn, exc)
    assert isinstance(response, HTMLResponse)
    assert response.status_code == 200


def test_json_accept_returns_401() -> None:
    conn = _make_conn("application/json")
    exc = AuthenticationError("bad token")
    response = _auth_error_handler(conn, exc)
    assert isinstance(response, JSONResponse)
    assert response.status_code == 401


def test_event_stream_accept_returns_401() -> None:
    conn = _make_conn("text/event-stream")
    exc = AuthenticationError("bad token")
    response = _auth_error_handler(conn, exc)
    assert isinstance(response, JSONResponse)
    assert response.status_code == 401


def test_no_accept_header_returns_401() -> None:
    conn = MagicMock()
    conn.headers = {}
    conn.scope = {"method": "GET"}
    exc = AuthenticationError("bad token")
    response = _auth_error_handler(conn, exc)
    assert isinstance(response, JSONResponse)
    assert response.status_code == 401


def test_json_401_body_is_rfc6750_compliant() -> None:
    conn = _make_conn("application/json")
    exc = AuthenticationError("expired")
    response = _auth_error_handler(conn, exc)
    assert response.status_code == 401
    assert response.headers.get("www-authenticate") == 'Bearer error="invalid_token"'


def test_html_accepted_alongside_other_types_but_not_json() -> None:
    conn = _make_conn("text/html, */*")
    exc = AuthenticationError("no token")
    response = _auth_error_handler(conn, exc)
    assert isinstance(response, HTMLResponse)
    assert response.status_code == 200


def test_accept_both_html_and_json_returns_401() -> None:
    # When a client lists both, treat it as an API client (application/json wins)
    conn = _make_conn("text/html, application/json")
    exc = AuthenticationError("bad token")
    response = _auth_error_handler(conn, exc)
    assert isinstance(response, JSONResponse)
    assert response.status_code == 401


def test_post_with_html_accept_returns_401() -> None:
    # Non-GET/HEAD methods always get JSON 401, even with text/html Accept
    conn = _make_conn("text/html", method="POST")
    exc = AuthenticationError("no token")
    response = _auth_error_handler(conn, exc)
    assert isinstance(response, JSONResponse)
    assert response.status_code == 401


def test_head_with_html_accept_returns_html_200() -> None:
    conn = _make_conn("text/html", method="HEAD")
    exc = AuthenticationError("no token")
    response = _auth_error_handler(conn, exc)
    assert isinstance(response, HTMLResponse)
    assert response.status_code == 200


def test_accept_header_case_insensitive() -> None:
    conn = _make_conn("TEXT/HTML")
    exc = AuthenticationError("no token")
    response = _auth_error_handler(conn, exc)
    assert isinstance(response, HTMLResponse)
    assert response.status_code == 200
