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
from typing import Any, Callable

from superset.extensions.cache_middleware import ExtensionCacheMiddleware

ResponseHeaders = list[tuple[str, str]]


def make_wsgi_app(
    status: str = "200 OK",
    headers: ResponseHeaders | None = None,
) -> Callable[..., Any]:
    """Returns a minimal WSGI app that calls start_response with the given headers."""

    def app(environ, start_response):  # noqa: ARG001
        start_response(status, headers or [])
        return [b"body"]

    return app


def call_middleware(
    path: str,
    upstream_headers: ResponseHeaders,
) -> ResponseHeaders:
    """Run middleware for a given path, return headers passed to start_response."""
    captured: list[ResponseHeaders] = []

    def start_response(status, headers, exc_info=None):  # noqa: ARG001
        captured.append(headers)

    wsgi_app = make_wsgi_app(headers=upstream_headers)
    middleware = ExtensionCacheMiddleware(wsgi_app)
    environ = {"PATH_INFO": path}
    list(middleware(environ, start_response))

    return captured[0]


# --- Path matching ---


def test_asset_path_is_intercepted() -> None:
    headers = call_middleware(
        "/api/v1/extensions/acme/my-ext/main.js",
        [("Vary", "Accept-Encoding, Cookie")],
    )
    vary = dict(headers).get("Vary", "")
    assert "Cookie" not in vary


def test_list_endpoint_is_not_intercepted() -> None:
    upstream = [("Vary", "Accept-Encoding, Cookie")]
    headers = call_middleware("/api/v1/extensions/", upstream)
    assert headers == upstream


def test_get_endpoint_is_not_intercepted() -> None:
    upstream = [("Vary", "Accept-Encoding, Cookie")]
    headers = call_middleware("/api/v1/extensions/acme/my-ext", upstream)
    assert headers == upstream


def test_info_endpoint_is_not_intercepted() -> None:
    upstream = [("Vary", "Accept-Encoding, Cookie")]
    headers = call_middleware("/api/v1/extensions/_info", upstream)
    assert headers == upstream


def test_unrelated_path_is_not_intercepted() -> None:
    upstream = [("Vary", "Accept-Encoding, Cookie")]
    headers = call_middleware("/api/v1/dashboard/", upstream)
    assert headers == upstream


# --- Vary stripping logic ---


def test_strips_cookie_from_vary() -> None:
    headers = call_middleware(
        "/api/v1/extensions/acme/my-ext/chunk.js",
        [("Vary", "Accept-Encoding, Cookie")],
    )
    assert dict(headers)["Vary"] == "Accept-Encoding"


def test_strips_cookie_case_insensitive() -> None:
    headers = call_middleware(
        "/api/v1/extensions/acme/my-ext/chunk.js",
        [("Vary", "Accept-Encoding, COOKIE")],
    )
    assert dict(headers)["Vary"] == "Accept-Encoding"


def test_removes_vary_header_when_cookie_is_only_value() -> None:
    headers = call_middleware(
        "/api/v1/extensions/acme/my-ext/chunk.js",
        [("Vary", "Cookie")],
    )
    assert "Vary" not in dict(headers)


def test_multiple_vary_headers_all_stripped() -> None:
    """Some middleware stacks emit multiple separate Vary headers."""
    headers = call_middleware(
        "/api/v1/extensions/acme/my-ext/chunk.js",
        [("Vary", "Cookie"), ("Vary", "Accept-Encoding, Cookie")],
    )
    vary_values = [v for k, v in headers if k == "Vary"]
    assert all("Cookie" not in v for v in vary_values)
    assert vary_values == ["Accept-Encoding"]


def test_non_vary_headers_are_preserved() -> None:
    headers = call_middleware(
        "/api/v1/extensions/acme/my-ext/chunk.wasm",
        [
            ("Content-Type", "application/wasm"),
            ("Cache-Control", "public, max-age=31536000, immutable"),
            ("Vary", "Accept-Encoding, Cookie"),
        ],
    )
    d = dict(headers)
    assert d["Content-Type"] == "application/wasm"
    assert d["Cache-Control"] == "public, max-age=31536000, immutable"


def test_vary_without_cookie_is_unchanged() -> None:
    headers = call_middleware(
        "/api/v1/extensions/acme/my-ext/chunk.js",
        [("Vary", "Accept-Encoding")],
    )
    assert dict(headers)["Vary"] == "Accept-Encoding"


def test_no_vary_header_produces_no_vary() -> None:
    headers = call_middleware(
        "/api/v1/extensions/acme/my-ext/chunk.js",
        [("Content-Type", "application/javascript")],
    )
    assert "Vary" not in dict(headers)
