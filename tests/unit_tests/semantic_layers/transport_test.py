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

"""Semantic-layer provider HTTP requests reach only allowed destinations."""

from __future__ import annotations

import importlib.util
import ipaddress
import logging
import os
import socket
import ssl
import subprocess
import sys
import textwrap
import time
import traceback
from collections.abc import Callable, Iterator
from concurrent.futures import Future, ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from importlib.machinery import ModuleSpec
from io import BytesIO
from pathlib import Path
from threading import Event, get_ident, Lock, Thread
from types import ModuleType
from typing import Any, cast, TypeAlias
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlsplit

import pytest
import requests
import urllib3.util.connection
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID
from flask import Flask
from superset_core.semantic_layers.transport import (
    ProviderRequestError,
    ProviderRequestFailure,
    ProviderResponse,
    ProviderTransport,
    RequestBudget,
)
from urllib3.response import HTTPResponse

from superset.semantic_layers import transport as semantic_layer_http
from superset.utils import json, network

# All tests run in their own pytest process; unrelated background traffic is
# explicitly exercised by the reference cases below.


def provider_request(
    provider: str, method: str, url: str, *, timeout: float, **kwargs: Any
) -> ProviderResponse:
    return semantic_layer_http.build_provider_transport().request(
        provider,
        method,
        url,
        budget=RequestBudget(time.monotonic() + timeout, 4 * 1024 * 1024),
        **kwargs,
    )


def provider_body(
    provider: str,
    method: str,
    url: str,
    *,
    deadline: float,
    max_bytes: int,
    timeout: tuple[float, float],
    **kwargs: Any,
) -> bytes:
    return (
        semantic_layer_http.build_provider_transport()
        .request(
            provider, method, url, budget=RequestBudget(deadline, max_bytes), **kwargs
        )
        .body
    )


@pytest.fixture(autouse=True)
def loopback_connections_only(monkeypatch: pytest.MonkeyPatch) -> None:
    """Make accidental outbound traffic fail the test before a socket connects."""
    original: Any = socket.socket.connect

    def connect(sock: socket.socket, address: Any) -> None:
        assert isinstance(address, tuple)
        assert ipaddress.ip_address(address[0]).is_loopback
        original(sock, address)

    monkeypatch.setattr(socket.socket, "connect", connect)


Route: TypeAlias = tuple[int, dict[str, str], bytes]
OK: Route = (200, {}, b'{"ok": true}')


class _Handler(BaseHTTPRequestHandler):
    routes: dict[str, Route] = {}
    seen: list[str] = []

    def _respond(self) -> None:
        self.seen.append(f"{self.command} {self.path} {self.headers['Host']}")
        status: int
        headers: dict[str, str]
        body: bytes
        status, headers, body = self.routes.get(self.path, OK)
        self.send_response(status)
        for key, value in headers.items():
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        self._respond()

    def do_POST(self) -> None:  # noqa: N802
        self.rfile.read(int(self.headers.get("Content-Length", 0)))
        self._respond()

    def log_message(self, *args: Any) -> None:
        pass


@contextmanager
def _server(
    routes: dict[str, Route] | None = None, context: ssl.SSLContext | None = None
) -> Iterator[tuple[int, list[str]]]:
    seen: list[str] = []
    handler: type[_Handler] = type(
        "Handler", (_Handler,), {"routes": routes or {}, "seen": seen}
    )
    server: HTTPServer = HTTPServer(("127.0.0.1", 0), handler)
    if context is not None:
        server.socket = context.wrap_socket(server.socket, server_side=True)
    thread: Thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server.server_address[1], seen
    finally:
        server.shutdown()
        server.server_close()


@contextmanager
def _dns_answers(hostname: str, answers: list[Any]) -> Iterator[None]:
    # Bounded requests resolve on provider-dns workers, so scope DNS by hostname.
    original: Any = socket.getaddrinfo

    def resolve(host: str, *args: Any, **kwargs: Any) -> Any:
        if host == hostname:
            return answers
        return original(host, *args, **kwargs)

    with patch.object(socket, "getaddrinfo", side_effect=resolve):
        yield


def _background_connection() -> None:
    """Complete real loopback traffic while a test's network patches are live."""
    with _server() as (port, _), ThreadPoolExecutor(1) as worker:
        connection: socket.socket = worker.submit(
            urllib3.util.connection.create_connection, ("127.0.0.1", port), timeout=1
        ).result(timeout=2)
        connection.close()


def _background_request() -> None:
    with _server() as (port, seen), ThreadPoolExecutor(1) as worker:
        with requests.Session() as session:
            session.trust_env = False
            response: requests.Response = worker.submit(
                session.get, f"http://127.0.0.1:{port}/background", timeout=1
            ).result(timeout=2)
        assert response.status_code == 200
    assert seen == [f"GET /background 127.0.0.1:{port}"]


def _certificate(directory: Path, name: str) -> tuple[Path, Path]:
    """Write a self-signed certificate for ``name``; return (cert, key) paths."""
    key: ec.EllipticCurvePrivateKey = ec.generate_private_key(ec.SECP256R1())
    subject: x509.Name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, name)])
    now: datetime = datetime.now(timezone.utc)
    certificate: x509.Certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=1))
        .not_valid_after(now + timedelta(hours=1))
        .add_extension(x509.SubjectAlternativeName([x509.DNSName(name)]), False)
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), True)
        .sign(key, hashes.SHA256())
    )
    cert_path: Path = directory / f"{name}.crt"
    key_path: Path = directory / f"{name}.key"
    cert_path.write_bytes(certificate.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    return cert_path, key_path


@contextmanager
def _internal_hosts(allowed: bool) -> Iterator[None]:
    app: Flask = Flask(__name__)
    app.config.update(
        WORKSPACE_NAME="semantic-layer-http-test",
        SEMANTIC_LAYER_ALLOW_INTERNAL_HOSTS=allowed,
    )
    with app.app_context():
        yield


@pytest.mark.parametrize("url", ["http://example.com/api", "ftp://example.com/x"])
def test_https_guard_ignores_background_requests(url: str) -> None:
    with patch("superset.semantic_layers.transport._DirectSession.request") as send:
        _background_request()
        with pytest.raises(ProviderRequestError, match="not allowed"):
            provider_request("Cube", "GET", url, timeout=1)
    send.assert_not_called()


@pytest.mark.parametrize("host", ["127.0.0.1", "localhost"])
def test_internal_address_is_refused_before_connecting(host: str) -> None:
    listener: socket.socket = socket.socket()
    listener.bind(("127.0.0.1", 0))
    listener.listen()
    listener.setblocking(False)
    port: int = listener.getsockname()[1]
    try:
        with pytest.raises(ProviderRequestError) as raised:
            provider_request("Cube", "GET", f"https://{host}:{port}/x", timeout=2)
        with pytest.raises(BlockingIOError):
            listener.accept()  # Nothing ever connected.
    finally:
        listener.close()
    assert host not in str(raised.value)
    assert str(port) not in str(raised.value)


def test_any_internal_answer_refuses_the_host() -> None:
    answers: list[tuple[Any, ...]] = [
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443)),
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.5", 443)),
    ]
    with (
        _dns_answers("mixed.example.com", answers),
        patch("superset.utils.network._connect_address") as connect,
    ):
        _background_connection()
        with pytest.raises(ProviderRequestError):
            provider_request("Cube", "GET", "https://mixed.example.com/x", timeout=1)
    connect.assert_not_called()


@pytest.mark.parametrize("address", ["64:ff9b::a9fe:a9fe", "64:ff9b::a00:5"])
def test_translated_ipv6_answers_are_checked_as_ipv4(address: str) -> None:
    answers: list[tuple[Any, ...]] = [
        (socket.AF_INET6, socket.SOCK_STREAM, 6, "", (address, 443, 0, 0)),
    ]
    with (
        _dns_answers("nat64.example.com", answers),
        patch("superset.utils.network._connect_address") as connect,
    ):
        _background_connection()
        with pytest.raises(ProviderRequestError):
            provider_request("Cube", "GET", "https://nat64.example.com/x", timeout=1)
    connect.assert_not_called()


def test_checked_connection_ignores_background_connections() -> None:
    answers: list[tuple[Any, ...]] = [
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443)),
    ]
    real_resolve: Any = socket.getaddrinfo
    resolved: list[str] = []

    def resolve(host: str, *args: Any, **kwargs: Any) -> Any:
        # socket.getaddrinfo is process-global: answer and record only this
        # test's host, and leave lookups from unrelated threads untouched.
        if host != "public.example.com":
            return real_resolve(host, *args, **kwargs)
        resolved.append(host)
        return answers

    with (
        patch.object(network.socket, "getaddrinfo", side_effect=resolve),
        patch(
            "superset.utils.network._connect_address",
            side_effect=OSError("stop"),
        ) as connect,
    ):
        _background_connection()
        # Deterministically model an unrelated lookup while the global hook is live.
        assert socket.getaddrinfo("localhost", 443) == real_resolve("localhost", 443)
        with pytest.raises(ProviderRequestError):
            provider_request("Cube", "GET", "https://public.example.com/x", timeout=1)
        _background_connection()
    assert resolved == ["public.example.com"]
    assert connect.call_args.args[0] == ("93.184.216.34", 443)


@pytest.fixture
def public_tls(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> tuple[ssl.SSLContext, list[str]]:
    """Treat ``*.example.test`` as public, served on 127.0.0.1 with a trusted cert."""
    cert: Path
    key: Path
    cert, key = _certificate(tmp_path, "public.example.test")
    context: ssl.SSLContext = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(cert, key)
    resolved: list[str] = []
    real_resolve: Any = socket.getaddrinfo

    owner: int = get_ident()

    def resolve(host: str, *args: Any, **kwargs: Any) -> Any:
        # Names also resolve on provider-dns workers; IP-literal connects belong
        # to the caller only. Do not record another thread's loopback traffic.
        if host.endswith(".example.test") or (
            host == "127.0.0.1" and get_ident() == owner
        ):
            resolved.append(host)
        local: str = "127.0.0.1" if host.endswith(".example.test") else host
        return real_resolve(local, *args, **kwargs)

    monkeypatch.setattr(network.socket, "getaddrinfo", resolve)
    monkeypatch.setattr(network, "is_safe_ip", lambda address: True)
    monkeypatch.setattr(requests.adapters, "DEFAULT_CA_BUNDLE_PATH", str(cert))
    return context, resolved


def test_public_tls_fixture_preserves_verification_choice(
    public_tls: tuple[ssl.SSLContext, list[str]],
) -> None:
    """Trust installation must not override a caller disabling verification."""
    session: semantic_layer_http._DirectSession
    with semantic_layer_http._DirectSession() as session:
        settings: semantic_layer_http._Settings = session.merge_environment_settings(
            "https://public.example.test/", {}, False, False, None
        )
    assert settings["verify"] is False


def test_public_tls_ignores_background_loopback_lookups(
    public_tls: tuple[ssl.SSLContext, list[str]],
) -> None:
    resolved: list[str] = public_tls[1]
    assert socket.getaddrinfo("localhost", 443)
    with ThreadPoolExecutor(1) as worker:
        assert worker.submit(socket.getaddrinfo, "127.0.0.1", 443).result(timeout=2)
    assert resolved == []
    assert socket.getaddrinfo("public.example.test", 443)
    assert socket.getaddrinfo("public.example.test", 443)
    assert resolved == ["public.example.test", "public.example.test"]


def test_default_path_verifies_the_configured_hostname(
    public_tls: tuple[ssl.SSLContext, list[str]],
) -> None:
    context: ssl.SSLContext
    resolved: list[str]
    context, resolved = public_tls
    with _server(context=context) as (port, seen):
        response: ProviderResponse = provider_request(
            "Cube", "GET", f"https://public.example.test:{port}/meta", timeout=2
        )
        with pytest.raises(ProviderRequestError, match="could not be reached"):
            # The certificate names public.example.test, not this host.
            provider_request(
                "Cube", "GET", f"https://other.example.test:{port}/meta", timeout=2
            )
    assert response.json() == {"ok": True}
    assert seen == [f"GET /meta public.example.test:{port}"]
    # Each hostname is resolved once; urllib3 then connects to the IP literal.
    names: list[str] = [host for host in resolved if not host[0].isdigit()]
    assert names == ["public.example.test", "other.example.test"]
    assert set(resolved) - set(names) == set()  # Numeric connects do not resolve again.


def test_default_path_rejects_an_untrusted_certificate(
    public_tls: tuple[ssl.SSLContext, list[str]], tmp_path: Path
) -> None:
    """A matching hostname alone does not establish certificate trust."""
    untrusted: Path = tmp_path / "untrusted"
    untrusted.mkdir()
    cert: Path
    key: Path
    cert, key = _certificate(untrusted, "public.example.test")
    context: ssl.SSLContext = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(cert, key)
    port: int
    seen: list[str]
    with _server(context=context) as (port, seen):
        with pytest.raises(ProviderRequestError, match="could not be reached"):
            provider_request(
                "fixture", "GET", f"https://public.example.test:{port}/", timeout=2
            )
    assert seen == []


def test_default_path_follows_same_origin_get_redirects_only(
    public_tls: tuple[ssl.SSLContext, list[str]],
) -> None:
    context: ssl.SSLContext = public_tls[0]
    routes: dict[str, Route] = {
        "/accounts": (308, {"Location": "/accounts/"}, b""),
        "/away": (302, {"Location": "https://other.example.test/x"}, b""),
    }
    with _server(routes, context) as (port, seen):
        base: str = f"https://public.example.test:{port}"
        response: ProviderResponse = provider_request(
            "MetricFlow", "GET", f"{base}/accounts", timeout=2
        )
        with pytest.raises(ProviderRequestError, match="HTTP 302"):
            provider_request("MetricFlow", "GET", f"{base}/away", timeout=2)
    assert response.json() == {"ok": True}
    assert [entry.split()[1] for entry in seen] == ["/accounts", "/accounts/", "/away"]


@pytest.mark.parametrize(
    "location,followed",
    [
        ("https://evil.example\\@provider.example/", False),
        ("https://evil.example%5C@provider.example/", False),
        ("https://attacker:pw@provider.example/x", False),
        ("https://@provider.example/x", True),
        ("https://:pw@provider.example/x", False),
        ("https://provider.example@evil.example/", False),
        ("https://PROVIDER.EXAMPLE/next", True),
        ("https://provider.example./next", False),
        ("https://provider.example:443/next", True),
        ("https://provider.example:8443/next", False),
        ("https://provider.example:0/next", True),
        ("http://provider.example/next", False),
        ("/next", True),
        ("/next\t", False),
        ("/next\n", False),
        ("/next\x00", False),
        ("/next\x7f", False),
        ("/next path", False),
    ],
)
def test_redirect_checks_prepared_destination(
    monkeypatch: pytest.MonkeyPatch, location: str, followed: bool
) -> None:
    """Exercise Requests preparation before capturing adapter-bound credentials."""
    sent: list[requests.PreparedRequest] = []

    def send(
        adapter: network.PinnedHTTPAdapter,
        request: requests.PreparedRequest,
        **kwargs: Any,
    ) -> requests.Response:
        sent.append(request)
        response: requests.Response = requests.Response()
        response.status_code = 302 if len(sent) == 1 else 200
        assert request.url is not None
        response.url = request.url
        response.request = request
        response.raw = HTTPResponse(body=BytesIO(b"ok"), preload_content=False)
        if len(sent) == 1:
            response.headers["Location"] = location
        return response

    monkeypatch.setattr(network.PinnedHTTPAdapter, "send", send)
    if followed:
        assert (
            provider_request(
                "fixture",
                "GET",
                "https://provider.example/start",
                timeout=2,
                headers={"Authorization": "Bearer private", "X-API-Key": "private"},
            ).status
            == 200
        )
    else:
        with pytest.raises(ProviderRequestError):
            provider_request(
                "fixture",
                "GET",
                "https://provider.example/start",
                timeout=2,
                headers={"Authorization": "Bearer private", "X-API-Key": "private"},
            )
    assert len(sent) == (2 if followed else 1)
    assert all(urlsplit(request.url).hostname == "provider.example" for request in sent)
    assert all(request.headers["X-API-Key"] == "private" for request in sent)
    assert all(request.headers["Authorization"] == "Bearer private" for request in sent)


@pytest.mark.parametrize("suffix", ["\\@provider.example/", "/path\n", "/a b"])
def test_ambiguous_first_hop_is_rejected_before_adapter(
    monkeypatch: pytest.MonkeyPatch, suffix: str
) -> None:
    """First-hop validation must not accept syntax Requests interprets differently."""
    send: Mock = Mock(side_effect=AssertionError("Invalid URL reached adapter"))
    monkeypatch.setattr(network.PinnedHTTPAdapter, "send", send)
    with pytest.raises(ProviderRequestError) as raised:
        provider_request("fixture", "GET", f"https://evil.example{suffix}", timeout=2)
    assert raised.value.failure == ProviderRequestFailure.INVALID_URL
    send.assert_not_called()


def test_hostless_prepared_url_is_invalid_before_adapter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Non-HTTP preparation can succeed without yielding a network hostname."""
    send: Mock = Mock(side_effect=AssertionError("Invalid URL reached adapter"))
    monkeypatch.setattr(network.PinnedHTTPAdapter, "send", send)
    raised: pytest.ExceptionInfo[ProviderRequestError]
    with pytest.raises(ProviderRequestError) as raised:
        provider_request("fixture", "GET", "mailto:provider@example.test", timeout=2)
    assert raised.value.failure == ProviderRequestFailure.INVALID_URL
    send.assert_not_called()


def test_missing_prepared_url_is_invalid_before_parsing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A missing result from preparation must not be passed to the URL parser."""
    prepare: Mock = Mock(return_value=None)
    parse: Mock = Mock(wraps=urlsplit)
    send: Mock = Mock(side_effect=AssertionError("Invalid URL reached adapter"))
    monkeypatch.setattr(requests.PreparedRequest, "prepare_url", prepare)
    monkeypatch.setattr(semantic_layer_http, "urlsplit", parse)
    monkeypatch.setattr(network.PinnedHTTPAdapter, "send", send)
    raised: pytest.ExceptionInfo[ProviderRequestError]
    with pytest.raises(ProviderRequestError) as raised:
        provider_request("fixture", "GET", "https://provider.example/", timeout=2)
    assert raised.value.failure == ProviderRequestFailure.INVALID_URL
    prepare.assert_called_once_with("https://provider.example/", None)
    parse.assert_not_called()
    send.assert_not_called()


@pytest.mark.parametrize("userinfo", ["user:pass", "user", ":pass"])
def test_first_hop_userinfo_is_refused_before_sending(
    monkeypatch: pytest.MonkeyPatch, userinfo: str
) -> None:
    """Provider credentials belong in headers, not URL authority."""
    send: Mock = Mock(side_effect=AssertionError("Userinfo reached adapter"))
    monkeypatch.setattr(network.PinnedHTTPAdapter, "send", send)
    raised: pytest.ExceptionInfo[ProviderRequestError]
    with pytest.raises(ProviderRequestError) as raised:
        provider_request(
            "fixture", "GET", f"https://{userinfo}@provider.example/", timeout=2
        )
    assert raised.value.failure == ProviderRequestFailure.INVALID_URL
    send.assert_not_called()


def test_flag_allows_local_http_development_endpoints() -> None:
    with _server() as (port, seen), _internal_hosts(True):
        response: ProviderResponse = provider_request(
            "Cube", "GET", f"http://localhost:{port}/meta", timeout=2
        )
    assert response.json() == {"ok": True}
    assert seen == [f"GET /meta localhost:{port}"]


def test_flag_off_keeps_local_endpoints_refused() -> None:
    with _server() as (port, seen), _internal_hosts(False):
        with pytest.raises(ProviderRequestError) as raised:
            provider_request("Cube", "GET", f"https://localhost:{port}/m", timeout=2)
    assert seen == []
    assert str(raised.value) == ("Cube endpoint is not allowed.")


def test_post_redirects_are_not_followed() -> None:
    routes: dict[str, Route] = {"/graphql": (307, {"Location": "/other"}, b"")}
    with _server(routes) as (port, seen), _internal_hosts(True):
        with pytest.raises(ProviderRequestError, match=r"^DJ request failed"):
            provider_request(
                "DJ", "POST", f"http://127.0.0.1:{port}/graphql", json={}, timeout=2
            )
    assert [entry.split()[:2] for entry in seen] == [["POST", "/graphql"]]


def test_redirect_chains_are_bounded() -> None:
    routes: dict[str, Route] = {"/loop": (302, {"Location": "/loop"}, b"")}
    with _server(routes) as (port, seen), _internal_hosts(True):
        with pytest.raises(ProviderRequestError, match="HTTP 302"):
            provider_request("DJ", "GET", f"http://127.0.0.1:{port}/loop", timeout=2)
    assert len(seen) == semantic_layer_http.MAX_REDIRECTS + 1


def test_error_message_carries_provider_and_status_only() -> None:
    routes: dict[str, Route] = {"/a": (500, {}, b"internal detail")}
    with _server(routes) as (port, _), _internal_hosts(True):
        with pytest.raises(ProviderRequestError) as raised:
            provider_request(
                "MetricFlow", "GET", f"http://127.0.0.1:{port}/a", timeout=2
            )
    assert str(raised.value) == "MetricFlow request failed with HTTP 500."


def test_transport_failure_hides_the_destination(
    caplog: pytest.LogCaptureFixture,
) -> None:
    with patch(
        "superset.semantic_layers.transport._DirectSession.request",
        side_effect=OSError("refused"),
    ):
        with pytest.raises(ProviderRequestError) as raised:
            provider_request(
                "DJ",
                "GET",
                "https://dj.internal.example.com:8443/x?token=t&password=pass",
                timeout=1,
            )
    assert "dj.internal" not in str(raised.value)
    assert "8443" not in str(raised.value)
    assert "dj.internal" not in caplog.text
    assert "unreachable" in caplog.text
    assert "pass" not in caplog.text
    assert "token" not in caplog.text


@pytest.mark.parametrize("allowed", [False, True])
def test_failure_logs_never_carry_url_secrets(
    caplog: pytest.LogCaptureFixture, allowed: bool
) -> None:
    listener: socket.socket = socket.socket()
    listener.bind(("127.0.0.1", 0))
    port: int = listener.getsockname()[1]
    listener.close()  # Nothing listens: the connection is refused or blocked.
    url: str = f"https://127.0.0.1:{port}/x?token=SECRET_TOKEN&password=SECRET_PW"
    with _internal_hosts(allowed), caplog.at_level("WARNING"):
        with pytest.raises(ProviderRequestError):
            provider_request("Cube", "GET", url, timeout=2)
    assert caplog.records
    assert "SECRET" not in caplog.text
    assert "unreachable" in caplog.text or "refused" in caplog.text


@pytest.mark.parametrize(
    "location",
    [
        "https://public.example.test:NOT_A_PORT/",
        "https://[public.example.test/",
    ],
)
def test_malformed_redirects_raise_the_safe_error(
    public_tls: tuple[ssl.SSLContext, list[str]],
    caplog: pytest.LogCaptureFixture,
    location: str,
) -> None:
    routes: dict[str, Route] = {"/a": (302, {"Location": location}, b"")}
    with _server(routes, public_tls[0]) as (port, seen), caplog.at_level("WARNING"):
        with pytest.raises(ProviderRequestError) as raised:
            provider_request(
                "Cube", "GET", f"https://public.example.test:{port}/a", timeout=2
            )
    assert "NOT_A_PORT" not in str(raised.value)
    assert "NOT_A_PORT" not in caplog.text
    assert len(seen) == 1


@pytest.mark.parametrize(
    "url", ["https://[dj.example.com/x", "https://dj.example.com:NOT_A_PORT/x"]
)
def test_malformed_endpoint_urls_raise_the_safe_error(url: str) -> None:
    with patch("superset.semantic_layers.transport._DirectSession.request") as send:
        _background_request()
        with pytest.raises(ProviderRequestError) as raised:
            provider_request("DJ", "GET", url, timeout=1)
    send.assert_not_called()
    assert "NOT_A_PORT" not in str(raised.value)


# --------------------------------------------------------------------------- #
# Bounded bodies: the same checks, plus a cumulative deadline and byte cap
# --------------------------------------------------------------------------- #
@contextmanager
def _dripping_server(
    context: ssl.SSLContext, size: int, interval: float, stall_after: int = -1
) -> Iterator[int]:
    """Serve ``size`` bytes one at a time, ``interval`` seconds apart.

    After ``stall_after`` bytes, stop sending for longer than any test waits.
    """

    class Drip(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802
            self.rfile.read(int(self.headers.get("Content-Length", 0)))
            self.send_response(200)
            self.send_header("Content-Length", str(size))
            self.end_headers()
            try:
                for sent in range(size):
                    if sent == stall_after:
                        time.sleep(5)
                    self.wfile.write(b"x")
                    self.wfile.flush()
                    time.sleep(interval)
            except OSError:
                pass  # The client gave up, as intended.

        def log_message(self, *args: Any) -> None:
            pass

    server: HTTPServer = HTTPServer(("127.0.0.1", 0), Drip)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    thread: Thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server.server_address[1]
    finally:
        server.shutdown()
        server.server_close()


def _body(
    url: str, *, seconds: float = 2.0, max_bytes: int = 4096, **kwargs: Any
) -> bytes:
    return provider_body(
        "MetricFlow",
        "POST",
        url,
        deadline=time.monotonic() + seconds,
        max_bytes=max_bytes,
        timeout=(5.0, 30.0),
        json={"query": "{ ok }"},
        **kwargs,
    )


def test_bounded_body_is_read_through_the_checked_connection(
    public_tls: tuple[ssl.SSLContext, list[str]],
) -> None:
    payload: bytes = b'{"data": {"ok": true}}'
    consumed: list[int] = []
    with _server({"/q": (200, {}, payload)}, public_tls[0]) as (port, seen):
        body: bytes = _body(
            f"https://public.example.test:{port}/q", consume=consumed.append
        )
    assert body == payload
    assert sum(consumed) == len(payload)
    # One lookup of the hostname; the connection then uses the checked address.
    assert public_tls[1].count("public.example.test") == 1
    assert seen == [f"POST /q public.example.test:{port}"]


def test_bounded_body_is_refused_past_its_byte_cap(
    public_tls: tuple[ssl.SSLContext, list[str]],
) -> None:
    consumed: list[int] = []
    with _server({"/q": (200, {}, b"x" * 3000)}, public_tls[0]) as (port, _):
        with pytest.raises(ProviderRequestError, match="byte budget"):
            _body(
                f"https://public.example.test:{port}/q",
                max_bytes=1024,
                consume=consumed.append,
            )
    assert 1024 < sum(consumed) <= 3000


def test_bounded_body_stops_at_the_deadline_while_dripping(
    public_tls: tuple[ssl.SSLContext, list[str]],
) -> None:
    started: float = time.monotonic()
    with _dripping_server(public_tls[0], size=200, interval=0.05) as port:
        with pytest.raises(ProviderRequestError) as raised:
            _body(f"https://public.example.test:{port}/q", seconds=0.5)
        assert raised.value.failure == ProviderRequestFailure.TIMEOUT
        elapsed: float = time.monotonic() - started  # Before server shutdown.
    # Per-read timeouts alone (30 s) would let the drip run for ten seconds.
    assert elapsed < 1.5


def test_bounded_read_after_progress_waits_only_for_the_time_left(
    public_tls: tuple[ssl.SSLContext, list[str]],
) -> None:
    # Bytes arrive for ~0.8 s, then stop. The first read's timeout was the whole
    # 1.2 s budget, so only re-arming it per read ends this near the deadline.
    started: float = time.monotonic()
    with _dripping_server(public_tls[0], 100, 0.05, stall_after=16) as port:
        with pytest.raises(ProviderRequestError, match="time budget") as raised:
            _body(f"https://public.example.test:{port}/q", seconds=1.2)
        assert raised.value.failure == ProviderRequestFailure.TIMEOUT
        elapsed: float = time.monotonic() - started  # Before server shutdown.
    assert elapsed < 1.7


@pytest.mark.parametrize("allow_internal", [False, True])
def test_bounded_lookup_waits_no_longer_than_the_deadline(
    monkeypatch: pytest.MonkeyPatch, allow_internal: bool
) -> None:
    def stuck(*args: Any, **kwargs: Any) -> Any:
        time.sleep(1.5)
        raise OSError("simulated stuck system resolver")

    real_resolve: Any = socket.getaddrinfo

    def scoped_resolve(host: str, *args: Any, **kwargs: Any) -> Any:
        if host == "slow-dns.example.test":
            return stuck(host, *args, **kwargs)
        return real_resolve(host, *args, **kwargs)

    monkeypatch.setattr(network.socket, "getaddrinfo", scoped_resolve)
    started: float = time.monotonic()
    with (
        _internal_hosts(allow_internal),
        pytest.raises(ProviderRequestError, match="time budget") as raised,
    ):
        _body("https://slow-dns.example.test/q", seconds=0.3)
    assert raised.value.failure == ProviderRequestFailure.TIMEOUT
    assert time.monotonic() - started < 1.0


def test_bounded_body_refuses_internal_destinations() -> None:
    answers: list[Any] = [(2, 1, 6, "", ("169.254.169.254", 443))]
    with (
        _dns_answers("metadata.example.test", answers),
        patch("superset.utils.network._connect_address") as connect,
    ):
        _background_connection()
        with pytest.raises(ProviderRequestError, match="not allowed"):
            _body("https://metadata.example.test/q")
    connect.assert_not_called()


def test_bounded_error_bodies_are_not_read_or_logged(
    public_tls: tuple[ssl.SSLContext, list[str]], caplog: pytest.LogCaptureFixture
) -> None:
    routes: dict[str, Route] = {"/q": (500, {}, b"internal detail")}
    with _server(routes, public_tls[0]) as (port, _), caplog.at_level("WARNING"):
        with pytest.raises(ProviderRequestError) as raised:
            _body(f"https://public.example.test:{port}/q")
    assert str(raised.value) == "MetricFlow request failed with HTTP 500."
    assert "internal detail" not in caplog.text


def test_bounded_body_refuses_encoded_responses(
    public_tls: tuple[ssl.SSLContext, list[str]],
) -> None:
    routes: dict[str, Route] = {"/q": (200, {"Content-Encoding": "gzip"}, b"\x1f\x8b")}
    with _server(routes, public_tls[0]) as (port, _):
        with pytest.raises(ProviderRequestError, match="encoding is not supported"):
            _body(f"https://public.example.test:{port}/q")


def test_bounded_post_redirects_are_not_followed(
    public_tls: tuple[ssl.SSLContext, list[str]],
) -> None:
    routes: dict[str, Route] = {"/q": (307, {"Location": "/elsewhere"}, b"")}
    with _server(routes, public_tls[0]) as (port, seen):
        with pytest.raises(ProviderRequestError, match="HTTP 307"):
            _body(f"https://public.example.test:{port}/q")
    assert [entry.split()[1] for entry in seen] == ["/q"]


def test_bounded_body_refuses_an_expired_deadline() -> None:
    with patch("superset.semantic_layers.transport._DirectSession.request") as send:
        _background_request()
        with pytest.raises(ProviderRequestError, match="time budget") as raised:
            _body("https://public.example.test/q", seconds=-1)
        assert raised.value.failure == ProviderRequestFailure.TIMEOUT
    send.assert_not_called()


@pytest.mark.parametrize("size", [0, 2 * 1024 * 1024])
def test_bounded_redirect_bodies_are_never_read(
    public_tls: tuple[ssl.SSLContext, list[str]], size: int
) -> None:
    # Requests pre-reads a redirect's body even with allow_redirects=False.
    observed: list[int] = []
    original: Any = vars(requests.Response)["content"].fget

    def content(response: requests.Response) -> bytes:
        body: bytes = original(response)
        # Response.content is process-global too; ignore other requests.
        if response.url == url:
            observed.append(len(body))
        return body

    routes: dict[str, Route] = {"/q": (307, {"Location": "/other"}, b"x" * size)}
    with _server(routes, public_tls[0]) as (port, seen):
        url: str = f"https://public.example.test:{port}/q"
        with patch.object(requests.Response, "content", property(content)):
            unrelated: requests.Response = requests.Response()
            unrelated.url = "https://unrelated.example.test/"
            unrelated._content = b"unrelated"
            assert unrelated.content == b"unrelated"
            assert observed == []
            owned: requests.Response = requests.Response()
            owned.url = url
            owned._content = b"owned"
            assert owned.content == b"owned"
            assert observed == [len(b"owned")]
            observed.clear()
            with pytest.raises(ProviderRequestError, match="HTTP 307"):
                _body(url, max_bytes=1024)
    assert len(seen) == 1
    assert observed == []


@contextmanager
def _framing_server(
    context: ssl.SSLContext, mode: str
) -> Iterator[tuple[int, Event, Event]]:
    """Drip HTTP framing bytes (a header or chunk trailer), not body bytes."""

    ready: Event = Event()
    release: Event = Event()
    stop: Event = Event()

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802
            self.rfile.read(int(self.headers.get("Content-Length", 0)))
            prefix: bytes = {
                "headers": b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\nX-Test: ",
                "chunk-trailers": b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked"
                b"\r\n\r\n0\r\nX-Trailer: ",
                # No length or chunking: the body ends when the connection does.
                "close-delimited": b"HTTP/1.0 200 OK\r\n\r\n",
            }[mode]
            try:
                self.wfile.write(prefix)
                self.wfile.flush()
                ready.set()
                if not release.wait(timeout=10):
                    return
                while not stop.wait(0.04):
                    self.wfile.write(b"x")
                    self.wfile.flush()
                self.wfile.write(b"\r\n\r\n")
                self.wfile.flush()
            except OSError:
                pass

        def log_message(self, *args: Any) -> None:
            pass

    server: HTTPServer = HTTPServer(("127.0.0.1", 0), Handler)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    thread: Thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server.server_address[1], ready, release
    finally:
        stop.set()
        release.set()
        server.shutdown()
        server.server_close()
        thread.join()


@pytest.mark.parametrize("mode", ["headers", "chunk-trailers", "close-delimited"])
@pytest.mark.parametrize("allow_internal", [False, True])
def test_bounded_framing_obeys_the_absolute_deadline(
    public_tls: tuple[ssl.SSLContext, list[str]],
    mode: str,
    allow_internal: bool,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Leave setup a generous budget. Only the transport's clock advances to
    # the final 200 ms once the server has sent the named framing prefix.
    offset: float = 0.0
    clock: Mock = Mock(wraps=time)
    clock.monotonic.side_effect = lambda: time.monotonic() + offset
    monkeypatch.setattr(semantic_layer_http, "time", clock)
    worker: ThreadPoolExecutor
    port: int
    ready: Event
    release: Event
    with (
        ThreadPoolExecutor(1) as worker,
        _framing_server(public_tls[0], mode) as (port, ready, release),
        _internal_hosts(allow_internal),
    ):
        deadline: float = time.monotonic() + 30
        future: Future[bytes] = worker.submit(
            provider_body,
            "MetricFlow",
            "POST",
            f"https://public.example.test:{port}/q",
            deadline=deadline,
            max_bytes=4096,
            timeout=(5.0, 30.0),
            json={"query": "{ ok }"},
        )
        assert ready.wait(timeout=10), "server did not reach framing mode"
        scheduler: semantic_layer_http.DeadlineScheduler = (
            semantic_layer_http._scheduler()
        )
        with scheduler._condition:
            offset = deadline - time.monotonic() - 0.2
            scheduler._condition.notify()
        release.set()
        with pytest.raises(ProviderRequestError) as raised:
            future.result(timeout=10)
        assert raised.value.failure == ProviderRequestFailure.TIMEOUT


def test_bounded_lookup_and_connect_attempts_share_the_deadline(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Two public answers that both stall on connect, after a slow lookup.
    answers: list[Any] = [
        (2, 1, 6, "", ("192.0.2.10", 443)),
        (2, 1, 6, "", ("192.0.2.11", 443)),
    ]

    def slow_lookup(*args: Any, **kwargs: Any) -> list[Any]:
        time.sleep(0.2)
        return answers

    waits: list[float] = []

    def stalled_connect(address: Any, timeout: Any, options: Any) -> Any:
        waits.append(float(timeout))
        time.sleep(float(timeout))
        raise socket.timeout("timed out")

    real_resolve: Any = socket.getaddrinfo

    def scoped_resolve(host: str, *args: Any, **kwargs: Any) -> Any:
        if host == "stalled.example.test":
            return slow_lookup(host, *args, **kwargs)
        return real_resolve(host, *args, **kwargs)

    monkeypatch.setattr(network.socket, "getaddrinfo", scoped_resolve)
    monkeypatch.setattr(network, "is_safe_ip", lambda address: True)
    started: float = time.monotonic()
    with patch("superset.utils.network._connect_address", side_effect=stalled_connect):
        with pytest.raises(ProviderRequestError) as raised:
            _body("https://stalled.example.test/q", seconds=0.5)
        assert raised.value.failure == ProviderRequestFailure.TIMEOUT
    elapsed: float = time.monotonic() - started
    # Each attempt waits only for what is left; separate full waits take 1.2 s.
    assert elapsed < 0.75, (elapsed, waits)


def test_bounded_internal_requests_ignore_environment_proxies(
    public_tls: tuple[ssl.SSLContext, list[str]], monkeypatch: pytest.MonkeyPatch
) -> None:
    """A proxy would own the socket, so a bounded request connects directly."""
    monkeypatch.setenv("HTTPS_PROXY", "http://127.0.0.1:9")
    monkeypatch.delenv("NO_PROXY", raising=False)
    monkeypatch.delenv("no_proxy", raising=False)
    payload: bytes = b'{"data": {"ok": true}}'
    with (
        _server({"/q": (200, {}, payload)}, public_tls[0]) as (
            port,
            seen,
        ),
        _internal_hosts(True),
    ):
        assert _body(f"https://public.example.test:{port}/q") == payload
    assert seen == [f"POST /q public.example.test:{port}"]


def test_former_unbounded_internal_requests_ignore_environment_proxies(
    public_tls: tuple[ssl.SSLContext, list[str]], monkeypatch: pytest.MonkeyPatch
) -> None:
    """The SDK has no unbounded mode; Q7 requires direct connections for all calls."""
    monkeypatch.setenv("HTTPS_PROXY", "http://127.0.0.1:9")
    monkeypatch.delenv("NO_PROXY", raising=False)
    monkeypatch.delenv("no_proxy", raising=False)
    with (
        _server({"/q": (200, {}, b"{}")}, public_tls[0]) as (port, seen),
        _internal_hosts(True),
    ):
        assert (
            provider_request(
                "MetricFlow",
                "GET",
                f"https://public.example.test:{port}/q",
                timeout=2.0,
            ).json()
            == {}
        )
    assert seen == [f"GET /q public.example.test:{port}"]


@pytest.mark.parametrize("allow_internal", [False, True])
@pytest.mark.parametrize("bounded", [False, True])
@pytest.mark.parametrize("failure", ["lookup", "empty"])
def test_dns_failure_is_not_an_address_policy_refusal(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    allow_internal: bool,
    failure: str,
    bounded: bool,
) -> None:
    def resolve(*args: Any, **kwargs: Any) -> list[Any]:
        if failure == "lookup":
            raise socket.gaierror(socket.EAI_NONAME, "private DNS detail")
        return []

    real_resolve: Any = socket.getaddrinfo

    def scoped_resolve(host: str, *args: Any, **kwargs: Any) -> Any:
        if host == "missing.example.test":
            return resolve(host, *args, **kwargs)
        return real_resolve(host, *args, **kwargs)

    monkeypatch.setattr(network.socket, "getaddrinfo", scoped_resolve)
    monkeypatch.setenv("NO_PROXY", "*")
    monkeypatch.setenv("no_proxy", "*")

    def call() -> None:
        if bounded:
            _body("https://missing.example.test/q")
        else:
            provider_request(
                "MetricFlow", "POST", "https://missing.example.test/q", timeout=1
            )

    with _internal_hosts(allow_internal), pytest.raises(ProviderRequestError) as raised:
        call()
    assert str(raised.value) == "MetricFlow endpoint could not be reached."
    assert "unreachable" in caplog.text
    assert "refused" not in caplog.text
    assert "private DNS detail" not in caplog.text


@pytest.mark.parametrize(
    "size,cap,success",
    [(16, 16, True), (17, 16, False), (65537, 65537, True), (65537, 65536, False)],
)
def test_byte_cap_boundaries_and_chunk_accounting(
    public_tls: tuple[ssl.SSLContext, list[str]], size: int, cap: int, success: bool
) -> None:
    consumed: list[int] = []
    with _server({"/q": (200, {}, b"x" * size)}, public_tls[0]) as (port, _):
        if success:
            assert (
                len(
                    _body(
                        f"https://public.example.test:{port}/q",
                        max_bytes=cap,
                        consume=consumed.append,
                    )
                )
                == size
            )
        else:
            with pytest.raises(ProviderRequestError) as raised:
                _body(
                    f"https://public.example.test:{port}/q",
                    max_bytes=cap,
                    consume=consumed.append,
                )
            assert raised.value.failure == ProviderRequestFailure.TOO_LARGE
    assert sum(consumed) == size
    assert max(consumed) <= 65536


@pytest.mark.parametrize(
    "provider,expected",
    [
        ("UNTRUSTED_LABEL", "UNTRUSTED_LABEL"),
        ("Cube\nforged=https://secret.test/", "Provider"),
    ],
)
def test_error_body_is_unread(
    provider: str,
    expected: str,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    from unittest.mock import MagicMock

    response: requests.Response = requests.Response()
    response.status_code = 503
    response.url = "https://fixture.test/secret"
    response.raw = MagicMock(spec=HTTPResponse)
    response.raw.read.side_effect = AssertionError("503 raw body was read")
    response.raw.read1.side_effect = AssertionError("503 raw body was read")

    def body_access(*args: Any, **kwargs: Any) -> bytes:
        raise AssertionError("503 body accessor was used")

    monkeypatch.setattr(requests.Response, "content", property(body_access))
    monkeypatch.setattr(requests.Response, "text", property(body_access))
    monkeypatch.setattr(response, "iter_content", body_access)
    monkeypatch.setattr(
        semantic_layer_http._DirectSession, "request", lambda *args, **kwargs: response
    )
    with pytest.raises(ProviderRequestError) as raised:
        provider_request(provider, "GET", response.url, timeout=1)
    assert raised.value.failure == ProviderRequestFailure.HTTP_STATUS
    response.raw.read1.assert_not_called()
    assert f"{expected} request failed: category=http_status status=503" in caplog.text
    assert str(raised.value) == f"{expected} request failed with HTTP 503."
    assert "secret" not in caplog.text
    assert "category=http_status status=503" in caplog.text


def test_tls_handshake_stall_is_bounded() -> None:
    from threading import Event

    done: Event = Event()
    listener: socket.socket = socket.socket()
    listener.bind(("127.0.0.1", 0))
    listener.listen()

    def serve() -> None:
        connection: socket.socket
        connection, _ = listener.accept()
        with connection:
            done.wait(2)

    worker: Thread = Thread(target=serve, daemon=True)
    worker.start()
    try:
        with _internal_hosts(True):
            start: float = time.monotonic()
            with pytest.raises(ProviderRequestError) as raised:
                provider_request(
                    "fixture",
                    "GET",
                    f"https://127.0.0.1:{listener.getsockname()[1]}/",
                    timeout=0.15,
                )
            assert raised.value.failure == ProviderRequestFailure.TIMEOUT
            assert time.monotonic() - start < 1.15
    finally:
        done.set()
        listener.close()
        worker.join(2)


def test_connect_boundary_stall_uses_real_socket_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Block real socket I/O at connect without a platform-specific SYN blackhole."""
    left: socket.socket
    right: socket.socket
    left, right = socket.socketpair()

    class ConnectingSocket:
        def setsockopt(self, level: int, option: int, value: int | bytes) -> None:
            assert (level, option, value) == (socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

        def settimeout(self, seconds: float) -> None:
            left.settimeout(seconds)

        def connect(self, address: tuple[str, int]) -> None:
            left.recv(1)  # Real blocking I/O, governed by production's connect timeout.

        def close(self) -> None:
            left.close()

    monkeypatch.setattr(
        network.socket, "socket", lambda *args, **kwargs: ConnectingSocket()
    )
    try:
        with _internal_hosts(True):
            start: float = time.monotonic()
            with pytest.raises(ProviderRequestError) as raised:
                provider_request(
                    "fixture", "GET", "http://127.0.0.1:12345/", timeout=0.15
                )
            assert raised.value.failure == ProviderRequestFailure.TIMEOUT
            assert time.monotonic() - start < 1.15
    finally:
        left.close()
        right.close()


def test_ten_concurrent_deadlines_release_descriptors() -> None:
    from http.server import ThreadingHTTPServer
    from threading import Event

    import psutil

    done: Event = Event()

    class Stall(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            self.send_response(200)
            self.send_header("Content-Length", "10")
            self.end_headers()
            self.wfile.write(b"x")
            self.wfile.flush()
            done.wait(2)

        def log_message(self, *args: Any) -> None:
            pass

    before: int = psutil.Process().num_fds()

    class ConcurrentServer(ThreadingHTTPServer):
        request_queue_size: int = 32

    server: ThreadingHTTPServer = ConcurrentServer(("127.0.0.1", 0), Stall)
    worker: Thread = Thread(
        target=lambda: server.serve_forever(poll_interval=0.02), daemon=True
    )
    worker.start()

    def call(index: int) -> tuple[float, float]:
        budget: float = 0.15 + index * 0.02
        start: float = time.monotonic()
        transport: semantic_layer_http.HostProviderTransport = (
            semantic_layer_http.HostProviderTransport(allow_internal_hosts=True)
        )
        with pytest.raises(ProviderRequestError) as raised:
            transport.request(
                "fixture",
                "GET",
                f"http://127.0.0.1:{server.server_port}/",
                budget=RequestBudget(start + budget, 100),
            )
        assert raised.value.failure == ProviderRequestFailure.TIMEOUT
        return time.monotonic() - start, budget

    try:
        with ThreadPoolExecutor(10) as pool:
            results: list[tuple[float, float]] = list(pool.map(call, range(10)))
        assert all(elapsed < budget + 1 for elapsed, budget in results)
    finally:
        done.set()
        server.shutdown()
        server.server_close()
        worker.join(2)
    deadline: float = time.monotonic() + 1
    while psutil.Process().num_fds() > before and time.monotonic() < deadline:
        time.sleep(0.01)
    assert psutil.Process().num_fds() <= before
    assert not semantic_layer_http._scheduler()._tokens


def test_scheduler_registration_after_expiry_and_close_are_safe() -> None:
    scheduler: semantic_layer_http.DeadlineScheduler = semantic_layer_http._scheduler()
    bound: semantic_layer_http._Deadline = semantic_layer_http._Deadline(
        time.monotonic() - 1
    )
    left: socket.socket
    right: socket.socket
    left, right = socket.socketpair()
    try:
        scheduler.register(bound, left)
        right.settimeout(0.2)
        assert right.recv(1) == b""
        scheduler.close(bound)
        scheduler.close(bound)
        assert not bound.sockets
    finally:
        left.close()
        right.close()


def test_policy_is_default_off_and_isolated() -> None:
    from superset import config

    assert config.SEMANTIC_LAYER_ALLOW_INTERNAL_HOSTS is False
    app: Flask = Flask(__name__)
    app.config.update(
        SEMANTIC_LAYER_ALLOW_INTERNAL_HOSTS=True,
        DATABASE_OAUTH2_ALLOW_INTERNAL_HOSTS=False,
        ALERT_REPORTS_WEBHOOK_ALLOW_INTERNAL_HOSTS=False,
    )
    with app.app_context():
        transport: ProviderTransport = semantic_layer_http.build_provider_transport()
        assert app.config["DATABASE_OAUTH2_ALLOW_INTERNAL_HOSTS"] is False
        assert app.config["ALERT_REPORTS_WEBHOOK_ALLOW_INTERNAL_HOSTS"] is False
    with _server() as (port, _):
        url: str = f"http://127.0.0.1:{port}/"
        assert (
            transport.request(
                "fixture", "GET", url, budget=RequestBudget(time.monotonic() + 1, 100)
            ).status
            == 200
        )
        with pytest.raises(ProviderRequestError):
            semantic_layer_http.build_provider_transport().request(
                "fixture", "GET", url, budget=RequestBudget(time.monotonic() + 1, 100)
            )


def test_consumer_failure_is_not_mislabeled_as_invalid_url(
    public_tls: tuple[ssl.SSLContext, list[str]],
) -> None:
    def consume(size: int) -> None:
        raise ValueError("caller budget exhausted")

    with _server(context=public_tls[0]) as (port, _):
        with pytest.raises(ValueError, match="caller budget exhausted"):
            _body(f"https://public.example.test:{port}/", consume=consume)


def test_cross_scheme_redirect_returns_status_without_reading_body(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from unittest.mock import MagicMock

    response: requests.Response = requests.Response()
    response.status_code = 302
    response.url = "https://fixture.test/"
    response.headers["Location"] = "http://fixture.test/"
    response.raw = MagicMock(spec=HTTPResponse)
    response.raw.read.side_effect = AssertionError("Refused redirect body was read")
    response.raw.read1.side_effect = AssertionError("Refused redirect body was read")

    def body_access(*args: Any, **kwargs: Any) -> bytes:
        raise AssertionError("Refused redirect body accessor was used")

    monkeypatch.setattr(requests.Response, "content", property(body_access))
    monkeypatch.setattr(requests.Response, "text", property(body_access))
    monkeypatch.setattr(response, "iter_content", body_access)
    send: MagicMock = MagicMock(return_value=response)
    monkeypatch.setattr(semantic_layer_http._DirectSession, "request", send)
    with pytest.raises(ProviderRequestError) as raised:
        provider_request("fixture", "GET", response.url, timeout=1)
    assert raised.value.failure == ProviderRequestFailure.HTTP_STATUS
    assert raised.value.status == 302
    response.raw.read1.assert_not_called()
    send.assert_called_once()


def test_completed_body_does_not_require_a_second_full_copy() -> None:
    """Keep an 8 MiB body to one buffer, allowing allocator slack and one chunk."""
    import tracemalloc
    from unittest.mock import MagicMock

    size: int = 8 * 1024 * 1024
    chunk: bytes = b"x" * 65536
    response: MagicMock = MagicMock()
    response.raw.read1.side_effect = [chunk] * (size // len(chunk)) + [b""]
    bound: semantic_layer_http._Deadline = semantic_layer_http._Deadline(
        time.monotonic() + 2
    )
    tracemalloc.start()
    try:
        body: bytes = semantic_layer_http.HostProviderTransport._read_body(
            response, bound, size, None
        )
        peak: int = tracemalloc.get_traced_memory()[1]
    finally:
        tracemalloc.stop()
    assert len(body) == size
    assert peak < size * 1.25 + len(chunk)


@pytest.mark.parametrize("bundle_variable", ["REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE"])
def test_internal_tls_honors_environment_ca_without_proxy(
    bundle_variable: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    cert: Path
    key: Path
    cert, key = _certificate(tmp_path, "localhost")
    context: ssl.SSLContext = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(cert, key)
    monkeypatch.delenv("REQUESTS_CA_BUNDLE", raising=False)
    monkeypatch.delenv("CURL_CA_BUNDLE", raising=False)
    monkeypatch.setenv(bundle_variable, str(cert))
    variable: str
    for variable in ("HTTPS_PROXY", "https_proxy", "ALL_PROXY", "all_proxy"):
        monkeypatch.setenv(variable, "http://127.0.0.1:1")
    monkeypatch.setenv("NO_PROXY", "")
    monkeypatch.setenv("no_proxy", "")
    # No Session/verify patch: real Requests must load the environment CA.
    with _server(context=context) as (port, seen), _internal_hosts(True):
        response: ProviderResponse = provider_request(
            "Cube", "GET", f"https://localhost:{port}/private-ca", timeout=2
        )
    assert response.status == 200
    assert len(seen) == 1


def test_closed_deadline_is_removed_by_worker_without_heap_rebuild() -> None:
    scheduler: semantic_layer_http.DeadlineScheduler = semantic_layer_http._scheduler()
    bound: semantic_layer_http._Deadline = semantic_layer_http._Deadline(
        time.monotonic() + 3600
    )
    left: socket.socket
    right: socket.socket
    left, right = socket.socketpair()
    try:
        with (
            scheduler._condition,
            patch.object(semantic_layer_http.heapq, "heapify") as rebuild,
        ):
            scheduler.register(bound, left)
            scheduler.close(bound)
            rebuild.assert_not_called()
            assert not bound.sockets
        until: float = time.monotonic() + 1
        while time.monotonic() < until:
            with scheduler._condition:
                if not any(item[2] is bound for item in scheduler._heap):
                    break
            time.sleep(0.001)
        with scheduler._condition:
            assert not any(item[2] is bound for item in scheduler._heap)
        assert not bound.expired
        left.sendall(b"still open")
        assert right.recv(10) == b"still open"
    finally:
        scheduler.close(bound)
        left.close()
        right.close()


@pytest.mark.skipif(not hasattr(os, "fork"), reason="POSIX worker lifecycle")
def test_fork_recreates_provider_workers_and_inherited_locks() -> None:
    # Isolate fork from pytest/Flask background threads; kill a stuck child too.
    script: str = textwrap.dedent("""
        import os
        import signal
        import socket
        import time
        from concurrent.futures import Future, ThreadPoolExecutor
        from superset.semantic_layers import transport
        from superset.utils import network

        network._resolve_addresses("127.0.0.1", 443, 1, public_only=False)
        transport._scheduler()
        resolver: ThreadPoolExecutor | None = network._RESOLVER
        scheduler: transport.DeadlineScheduler | None = transport._SCHEDULER
        for _ in range(network._RESOLVER_LIMIT):
            assert network._RESOLVER_SLOTS.acquire(blocking=False)
        network._RESOLVER_LOCK.acquire()
        assert transport._SCHEDULER_LOCK is not None
        transport._SCHEDULER_LOCK.acquire()
        transport._SCHEDULER_LOCK_INIT.acquire()
        pid: int = os.fork()
        if pid == 0:
            signal.alarm(4)
            try:
                assert network._RESOLVER is None
                assert transport._SCHEDULER is None
                assert network._resolve_addresses(
                    "127.0.0.1", 443, 1, public_only=False
                ) == ["127.0.0.1"]
                left: socket.socket
                right: socket.socket
                left, right = socket.socketpair()
                right.settimeout(1)
                bound: transport._Deadline = transport._Deadline(
                    time.monotonic() + 0.05
                )
                bound.watch(left)
                assert right.recv(1) == b""
                assert bound.expired
                bound.close()
                left.close()
                right.close()
            except BaseException:
                import traceback
                traceback.print_exc()
                os._exit(1)
            os._exit(0)
        for _ in range(network._RESOLVER_LIMIT):
            network._RESOLVER_SLOTS.release()
        network._RESOLVER_LOCK.release()
        transport._SCHEDULER_LOCK.release()
        transport._SCHEDULER_LOCK_INIT.release()
        status: int
        _, status = os.waitpid(pid, 0)
        assert os.waitstatus_to_exitcode(status) == 0
        assert network._RESOLVER is resolver
        assert transport._SCHEDULER is scheduler
        assert network._resolve_addresses(
                    "127.0.0.1", 443, 1, public_only=False
                ) == ["127.0.0.1"]
    """)
    result: subprocess.CompletedProcess[str] = subprocess.run(  # noqa: S603 -- fixed local test script, no external input
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.parametrize("authorization", [None, "Bearer provider-owned-token"])
def test_internal_requests_never_read_netrc(
    authorization: str | None, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from unittest.mock import Mock

    netrc_path: Path = tmp_path / "netrc"
    netrc_path.write_text("machine localhost login fixture password netrc-secret\n")
    netrc_path.chmod(0o600)
    monkeypatch.setenv("NETRC", str(netrc_path))
    lookup: Mock = Mock(wraps=requests.sessions.get_netrc_auth)
    monkeypatch.setattr(requests.sessions, "get_netrc_auth", lookup)
    observed: list[str | None] = []
    original: Callable[[_Handler], None] = _Handler._respond

    def respond(handler: _Handler) -> None:
        observed.append(handler.headers.get("Authorization"))
        original(handler)

    monkeypatch.setattr(_Handler, "_respond", respond)
    headers: dict[str, str] = (
        {"Authorization": authorization} if authorization is not None else {}
    )
    with _server() as (port, _), _internal_hosts(True):
        response: ProviderResponse = provider_request(
            "Cube", "GET", f"http://localhost:{port}/", timeout=2, headers=headers
        )
    assert response.status == 200
    assert observed == [authorization]
    lookup.assert_not_called()


@pytest.mark.parametrize("provider", [None, 42, {"url": "https://secret.test/"}])
def test_non_string_label_cannot_chain_library_secrets(
    provider: object, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    from unittest.mock import Mock

    raw: str = "https://private.test/path?token=raw-secret"
    send: Mock = Mock(side_effect=requests.ConnectionError(raw))
    monkeypatch.setattr(semantic_layer_http._DirectSession, "request", send)
    with pytest.raises(ProviderRequestError) as raised:
        provider_request(cast(str, provider), "GET", raw, timeout=2)
    assert raised.value.failure is ProviderRequestFailure.UNREACHABLE
    assert str(raised.value) == "Provider endpoint could not be reached."
    assert raised.value.__cause__ is None
    assert raised.value.__suppress_context__
    rendered: str = "".join(traceback.format_exception(raised.value))
    assert "raw-secret" not in rendered
    assert "private.test" not in rendered
    assert "raw-secret" not in caplog.text
    assert "private.test" not in caplog.text
    send.assert_called_once()


def test_missing_hostname_is_rejected_before_io() -> None:
    send: Mock
    raised: pytest.ExceptionInfo[ProviderRequestError]
    with patch.object(semantic_layer_http._DirectSession, "request") as send:
        with pytest.raises(ProviderRequestError) as raised:
            provider_request("fixture", "GET", "https:///missing-host", timeout=1)
    assert raised.value.failure is ProviderRequestFailure.INVALID_URL
    send.assert_not_called()


def test_closed_deadline_does_not_duplicate_or_shutdown_socket() -> None:
    scheduler: semantic_layer_http.DeadlineScheduler = semantic_layer_http._scheduler()
    bound: semantic_layer_http._Deadline = semantic_layer_http._Deadline(
        time.monotonic() - 1
    )
    left: socket.socket
    right: socket.socket
    left, right = socket.socketpair()
    try:
        scheduler.close(bound)
        scheduler.register(bound, left)
        assert not bound.sockets
        assert bound not in scheduler._tokens
        assert not bound.expired
        right.settimeout(0.2)
        left.sendall(b"open")
        assert right.recv(4) == b"open"
    finally:
        scheduler.close(bound)
        left.close()
        right.close()


def test_shutdown_error_does_not_skip_other_owned_sockets() -> None:
    failed: Mock = Mock(spec=socket.socket)
    failed.shutdown.side_effect = OSError("already disconnected")
    left: socket.socket
    right: socket.socket
    left, right = socket.socketpair()
    bound: semantic_layer_http._Deadline = semantic_layer_http._Deadline(
        time.monotonic() - 1, sockets=[failed, left.dup()]
    )
    try:
        semantic_layer_http.DeadlineScheduler._expire(bound)
        assert bound.expired
        failed.shutdown.assert_called_once_with(socket.SHUT_RDWR)
        right.settimeout(0.2)
        assert right.recv(1) == b""
    finally:
        semantic_layer_http._scheduler().close(bound)
        left.close()
        right.close()
    failed.close.assert_called_once()
    assert not bound.sockets


@pytest.mark.parametrize("fork_available", [True, False])
def test_registered_fork_hook_resets_only_child_scheduler_state(
    fork_available: bool, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Load a separate module instance: never replace the live worker or its lock.
    spec: ModuleSpec | None = importlib.util.spec_from_file_location(
        "_isolated_provider_transport", semantic_layer_http.__file__
    )
    assert spec is not None
    assert spec.loader is not None
    isolated: ModuleType = importlib.util.module_from_spec(spec)
    monkeypatch.setitem(sys.modules, spec.name, isolated)
    register: Mock = Mock()
    platform: pytest.MonkeyPatch
    with monkeypatch.context() as platform:
        if fork_available:
            platform.setattr(os, "register_at_fork", register, raising=False)
        else:
            platform.delattr(os, "register_at_fork", raising=False)
        spec.loader.exec_module(isolated)
    assert isolated._SCHEDULER is None
    if not fork_available:
        register.assert_not_called()
        return
    register.assert_called_once_with(
        after_in_child=isolated._reset_scheduler_after_fork
    )
    inherited_scheduler: Mock = Mock(spec=isolated.DeadlineScheduler)
    monkeypatch.setattr(isolated, "_SCHEDULER", inherited_scheduler)
    inherited_lock: Lock = Lock()
    monkeypatch.setattr(isolated, "_SCHEDULER_LOCK", inherited_lock)
    inherited_lock.acquire()
    parent_scheduler: semantic_layer_http.DeadlineScheduler | None = (
        semantic_layer_http._SCHEDULER
    )
    parent_lock: Lock | None = semantic_layer_http._SCHEDULER_LOCK
    callback: Callable[[], None] = register.call_args.kwargs["after_in_child"]
    try:
        callback()
        assert isolated._SCHEDULER is None
        assert isolated._SCHEDULER_LOCK is not inherited_lock
        assert isolated._SCHEDULER_LOCK is None
        assert semantic_layer_http._SCHEDULER is parent_scheduler
        assert semantic_layer_http._SCHEDULER_LOCK is parent_lock
        assert not inherited_scheduler.mock_calls
    finally:
        inherited_lock.release()


@pytest.mark.parametrize("component", ["resolver", "scheduler"])
def test_preloaded_gevent_worker_does_not_hold_native_lock_during_start(
    component: str,
) -> None:
    """Import before patching, then overlap first-use worker startup."""
    pytest.importorskip("gevent")
    script: str = textwrap.dedent("""
        import signal
        import sys
        from superset.semantic_layers import transport
        from superset.utils import network
        from gevent import monkey

        monkey.patch_all()
        import gevent

        signal.alarm(8)
        def run() -> object:
            if sys.argv[1] == "resolver":
                return network.resolve_public_addresses("8.8.8.8", 443, timeout=1)
            return transport._scheduler()

        jobs: list[gevent.Greenlet] = [gevent.spawn(run) for _ in range(2)]
        gevent.joinall(jobs, timeout=3, raise_error=True)
        assert all(job.ready() for job in jobs), "worker startup stalled"
        if sys.argv[1] == "resolver":
            assert all(job.value == ["8.8.8.8"] for job in jobs)
        else:
            assert jobs[0].value is jobs[1].value
        signal.alarm(0)
        print("completed both requests", flush=True)
    """)
    result: subprocess.CompletedProcess[str] = subprocess.run(  # noqa: S603
        [sys.executable, "-c", script, component],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "completed both requests" in result.stdout


def test_dns_admission_refusal_is_a_transport_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Requests wrapping must preserve the resolver capacity timeout category."""
    from threading import BoundedSemaphore

    monkeypatch.setattr(network, "_RESOLVER_SLOTS", BoundedSemaphore(0))
    raised: pytest.ExceptionInfo[ProviderRequestError]
    with _internal_hosts(True), pytest.raises(ProviderRequestError) as raised:
        provider_request("fixture", "GET", "http://provider.example/", timeout=2)
    assert raised.value.failure == ProviderRequestFailure.TIMEOUT


def test_scheduler_start_failure_does_not_publish_an_unstarted_worker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Failed initialization must leave the singleton retryable."""
    monkeypatch.setattr(semantic_layer_http, "_SCHEDULER", None)
    monkeypatch.setattr(
        semantic_layer_http.Thread,
        "start",
        Mock(side_effect=RuntimeError("thread startup failed")),
    )
    with pytest.raises(RuntimeError, match="thread startup failed"):
        semantic_layer_http._scheduler()
    assert semantic_layer_http._SCHEDULER is None


def test_scheduler_lock_initialization_is_serialized_across_os_threads() -> None:
    """Widen first-use interleavings without leaving orphan workers in pytest."""
    script: str = textwrap.dedent("""
        import time
        from concurrent.futures import Future, ThreadPoolExecutor
        from threading import Barrier, Lock
        from types import SimpleNamespace
        from superset.semantic_layers import transport

        original: type[transport.DeadlineScheduler] = transport.DeadlineScheduler
        barrier: Barrier = Barrier(4)
        def make_lock() -> Lock:
            time.sleep(0.05)
            return Lock()
        def make_scheduler() -> transport.DeadlineScheduler:
            time.sleep(0.05)
            return original()
        transport.threading = SimpleNamespace(Lock=make_lock)
        transport.DeadlineScheduler = make_scheduler
        def get_scheduler(index: int) -> object:
            barrier.wait(timeout=5)
            return transport._scheduler()
        with ThreadPoolExecutor(4) as pool:
            schedulers: list[object] = list(pool.map(get_scheduler, range(4)))
        assert len({id(scheduler) for scheduler in schedulers}) == 1
    """)
    result: subprocess.CompletedProcess[str] = subprocess.run(  # noqa: S603
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_keep_alive_redirect_releases_abandoned_connection() -> None:
    """A single-threaded provider must accept the next hop before the deadline."""
    seen: list[str] = []

    class KeepAlive(BaseHTTPRequestHandler):
        protocol_version: str = "HTTP/1.1"

        def do_GET(self) -> None:  # noqa: N802
            seen.append(self.path)
            if self.path == "/start":
                self.send_response(302)
                self.send_header("Location", "/final")
                self.send_header("Content-Length", "4")
                self.end_headers()
                self.wfile.write(b"skip")
                self.wfile.flush()
            else:
                self.send_response(200)
                self.send_header("Content-Length", "2")
                self.send_header("Connection", "close")
                self.end_headers()
                self.wfile.write(b"ok")
                self.close_connection = True

        def log_message(self, *args: Any) -> None:
            pass

    server: HTTPServer = HTTPServer(("127.0.0.1", 0), KeepAlive)
    worker: Thread = Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        with _internal_hosts(True):
            response: ProviderResponse = provider_request(
                "fixture",
                "GET",
                f"http://127.0.0.1:{server.server_port}/start",
                timeout=1,
            )
        assert response.body == b"ok"
        assert seen == ["/start", "/final"]
    finally:
        server.shutdown()
        server.server_close()
        worker.join(2)


def test_releasing_sockets_without_a_scheduler_is_a_noop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Cleanup before a connection must not initialize deadline infrastructure."""
    monkeypatch.setattr(semantic_layer_http, "_SCHEDULER", None)
    start: Mock = Mock(side_effect=AssertionError("Cleanup started a scheduler"))
    monkeypatch.setattr(semantic_layer_http, "_scheduler", start)
    bound: semantic_layer_http._Deadline = semantic_layer_http._Deadline(
        time.monotonic() + 1
    )
    bound.release_sockets()
    start.assert_not_called()
    assert semantic_layer_http._SCHEDULER is None
    assert not bound.sockets
    assert not bound.closed
    assert not bound.expired


def test_post_transmits_query_params_and_json_body() -> None:
    """Verify provider payloads at the server, beyond request-call mocks."""
    received: list[tuple[str, bytes]] = []

    class CapturePostHandler(_Handler):
        """Capture wire bytes before returning the ordinary loopback response."""

        seen: list[str] = []

        def do_POST(self) -> None:  # noqa: N802
            """Retain the request target and body for independent assertions."""
            body: bytes = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            received.append((self.path, body))
            self._respond()

    server: HTTPServer
    with HTTPServer(("127.0.0.1", 0), CapturePostHandler) as server:
        thread: Thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with _internal_hosts(True):
                response: ProviderResponse = provider_request(
                    "Cube",
                    "POST",
                    f"http://127.0.0.1:{server.server_port}/graphql",
                    params={"page": "2"},
                    json={"query": "{ ok }"},
                    timeout=2,
                )
            assert response.status == 200
            assert len(received) == 1
            path: str
            body: bytes
            path, body = received[0]
            assert urlsplit(path).path == "/graphql"
            assert parse_qs(urlsplit(path).query) == {"page": ["2"]}
            assert json.loads(body) == {"query": "{ ok }"}
        finally:
            server.shutdown()
            thread.join(timeout=2)


def test_provider_debug_logs_omit_query_tokens(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Provider requests stay private while unrelated urllib3 logs remain visible."""

    def consume(count: int) -> None:
        """Run unrelated HTTP while the provider request context is active."""
        worker: ThreadPoolExecutor
        # Provider context is active here, but not in this unrelated thread.
        with ThreadPoolExecutor(1) as worker:
            worker.submit(_background_request).result(timeout=5)

    port: int
    with (
        caplog.at_level(logging.DEBUG, logger="urllib3.connectionpool"),
        _server() as (port, _),
        _internal_hosts(True),
    ):
        response: ProviderResponse = provider_request(
            "Example",
            "GET",
            f"http://127.0.0.1:{port}/catalog?token=SECRET",
            timeout=2,
            consume=consume,
        )
        assert response.status == 200
    assert "SECRET" not in caplog.text
    assert "/catalog" not in caplog.text
    assert any(
        record.name == "urllib3.connectionpool" and "/background" in record.getMessage()
        for record in caplog.records
    )
