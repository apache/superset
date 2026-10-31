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
import ipaddress
from unittest.mock import MagicMock, patch

import pytest

from superset.utils.network import (
    get_ssrf_safe_requester,
    is_safe_host,
    is_safe_ip,
    PeerValidatingHTTPAdapter,
    SSRFProtectionError,
)


@pytest.mark.parametrize(
    ("ip", "expected"),
    [
        # Public → safe
        ("93.184.216.34", True),
        ("8.8.8.8", True),
        ("2606:2800:220:1:248:1893:25c8:1946", True),
        # Loopback → unsafe
        ("127.0.0.1", False),
        ("::1", False),
        # RFC-1918 private ranges → unsafe
        ("10.0.0.1", False),
        ("172.16.0.1", False),
        ("192.168.0.1", False),
        # Link-local / IMDS → unsafe
        ("169.254.169.254", False),
        # CGNAT (RFC 6598) → unsafe
        ("100.100.100.200", False),
        # Multicast → unsafe, despite ip.is_global being True for these
        ("224.0.0.1", False),
        ("ff02::1", False),
        # IPv4-mapped IPv6 → unwrapped and checked against IPv4 ranges
        ("::ffff:127.0.0.1", False),
        ("::ffff:8.8.8.8", True),
    ],
)
def test_is_safe_ip(ip: str, expected: bool) -> None:
    """`is_safe_ip` must classify individual addresses directly, independent
    of hostname resolution."""
    assert is_safe_ip(ipaddress.ip_address(ip)) is expected


@pytest.mark.parametrize(
    ("resolved_ip", "expected"),
    [
        # Public IPs → safe
        ("93.184.216.34", True),  # example.com
        ("8.8.8.8", True),  # Google DNS
        ("2606:2800:220:1:248:1893:25c8:1946", True),  # example.com IPv6
        # Loopback → unsafe
        ("127.0.0.1", False),
        ("::1", False),
        # RFC-1918 private ranges → unsafe
        ("10.0.0.1", False),
        ("10.255.255.255", False),
        ("172.16.0.1", False),
        ("172.31.255.255", False),
        ("192.168.0.1", False),
        ("192.168.255.255", False),
        # Link-local / IMDS → unsafe
        ("169.254.169.254", False),  # AWS/GCP/Azure metadata
        ("169.254.0.1", False),
        # 0.0.0.0/8 → unsafe
        ("0.0.0.1", False),
        # IPv4 multicast (224.0.0.0/4) → unsafe; ip.is_global returns True for
        # multicast in Python, so the explicit blocklist entry is the only guard.
        ("224.0.0.1", False),
        ("239.255.255.255", False),
        # IPv6 private → unsafe
        ("fc00::1", False),
        ("fe80::1", False),
        # IPv6 multicast (ff00::/8) → unsafe
        ("ff02::1", False),
        ("ff0e::1", False),
    ],
)
def test_is_safe_host_ip_classification(resolved_ip: str, expected: bool) -> None:
    """Hosts resolving to private/internal IPs must be rejected."""
    with patch(
        "superset.utils.network.socket.getaddrinfo",
        return_value=[(None, None, None, None, (resolved_ip, 0))],
    ):
        assert is_safe_host("any-hostname") is expected


def test_is_safe_host_unresolvable_returns_false() -> None:
    """Unresolvable hostnames must return False (fail-closed)."""
    import socket

    with patch(
        "superset.utils.network.socket.getaddrinfo",
        side_effect=socket.gaierror("Name or service not known"),
    ):
        assert is_safe_host("nonexistent.invalid") is False


def test_is_safe_host_empty_results_returns_false() -> None:
    """An empty getaddrinfo result must return False (fail-closed)."""
    with patch(
        "superset.utils.network.socket.getaddrinfo",
        return_value=[],
    ):
        assert is_safe_host("empty-result.example.com") is False


def test_is_safe_host_malformed_sockaddr_returns_false() -> None:
    """A sockaddr that cannot be parsed as an IP address must return False."""
    with patch(
        "superset.utils.network.socket.getaddrinfo",
        return_value=[(None, None, None, None, ("not-an-ip", 0))],
    ):
        assert is_safe_host("malformed") is False


def test_is_safe_host_rejects_if_any_ip_is_private() -> None:
    """A hostname that resolves to both a public and a private IP (split-DNS
    or multi-homed host) must be rejected — all resolved IPs must be safe."""
    with patch(
        "superset.utils.network.socket.getaddrinfo",
        return_value=[
            (None, None, None, None, ("8.8.8.8", 0)),
            (None, None, None, None, ("10.0.0.1", 0)),  # private — must fail
        ],
    ):
        assert is_safe_host("dual-homed.example.com") is False


@pytest.mark.parametrize(
    "mapped_ip",
    [
        "::ffff:127.0.0.1",  # loopback via IPv4-mapped IPv6
        "::ffff:10.0.0.1",  # RFC-1918 via IPv4-mapped IPv6
        "::ffff:169.254.169.254",  # link-local via IPv4-mapped IPv6
    ],
)
def test_is_safe_host_rejects_ipv4_mapped_ipv6(mapped_ip: str) -> None:
    """IPv4-mapped IPv6 addresses must be unwrapped and checked against the
    IPv4 unsafe networks — not treated as safe IPv6 addresses."""
    with patch(
        "superset.utils.network.socket.getaddrinfo",
        return_value=[(None, None, None, None, (mapped_ip, 0, 0, 0))],
    ):
        assert is_safe_host("mapped") is False


def test_is_safe_host_rejects_cgnat_range() -> None:
    """100.64.0.0/10 (RFC 6598 shared address space) must be rejected."""
    with patch(
        "superset.utils.network.socket.getaddrinfo",
        return_value=[(None, None, None, None, ("100.100.100.200", 0))],
    ):
        assert is_safe_host("cgnat-host") is False


def test_peer_validating_connection_blocks_rebound_peer() -> None:
    """
    A hostname that passes ``is_safe_host`` at validation time and then
    re-resolves to an internal address by the time the connection is opened
    (DNS rebinding) must be rejected before any request bytes are sent --
    mirrors the equivalent test for webhook dispatch and dataset-import
    data-URI fetches, which use the same pattern.
    """
    from urllib3.connection import HTTPConnection

    from superset.utils.network import _PeerValidatingHTTPConnection

    sock = MagicMock()
    sock.getpeername.return_value = ("169.254.169.254", 80)

    with patch.object(
        HTTPConnection, "connect", lambda self: setattr(self, "sock", sock)
    ):
        conn = _PeerValidatingHTTPConnection("rebinder.example.com")
        with pytest.raises(SSRFProtectionError):
            conn.connect()


def test_peer_validating_connection_allows_public_peer() -> None:
    """A connection whose actual peer resolves to a public address is
    allowed through unmodified."""
    from urllib3.connection import HTTPConnection

    from superset.utils.network import _PeerValidatingHTTPConnection

    sock = MagicMock()
    sock.getpeername.return_value = ("93.184.216.34", 80)  # example.com, public

    with patch.object(
        HTTPConnection, "connect", lambda self: setattr(self, "sock", sock)
    ):
        conn = _PeerValidatingHTTPConnection("example.com")
        conn.connect()  # should not raise


def test_get_ssrf_safe_requester_returns_plain_requests_when_allowed() -> None:
    """
    With ``allow_unsafe_hosts=True`` (an explicit, documented operator
    opt-in), the plain ``requests`` module is returned -- no peer pinning.
    """
    import requests

    assert get_ssrf_safe_requester(allow_unsafe_hosts=True) is requests


def test_get_ssrf_safe_requester_ignores_environment_proxies() -> None:
    """
    An environment proxy would route the request through a ProxyManager whose
    pools bypass the peer-validating connection classes (and whose peer is the
    proxy, not the target), leaving the rebinding check inactive -- so the
    protected session must not honour HTTP(S)_PROXY.
    """
    assert get_ssrf_safe_requester().trust_env is False


def test_get_ssrf_safe_requester_pins_peer_by_default() -> None:
    """
    By default, ``get_ssrf_safe_requester`` returns a session whose adapters
    validate the connected peer address rather than the plain ``requests``
    module.
    """
    requester = get_ssrf_safe_requester()
    assert isinstance(requester.get_adapter("http://x/"), PeerValidatingHTTPAdapter)
    assert isinstance(requester.get_adapter("https://x/"), PeerValidatingHTTPAdapter)


@pytest.mark.parametrize(
    ("address", "expected"),
    [
        ("0.0.0.1", False),
        ("255.255.255.255", False),
        ("64:ff9b::7f00:1", False),
        ("64:ff9b::a9fe:a9fe", False),
        ("64:ff9b::808:808", True),
        ("64:ff9b:1::808:808", False),
        ("::127.0.0.1", False),
        ("::8.8.8.8", False),
        ("2002:7f00:1::1", False),
        ("2002:0808:0808::1", False),
        ("2001:0:4136:e378:8000:63bf:3fff:fdd2", False),
    ],
)
def test_address_forms(address: str, expected: bool) -> None:
    """Pin the policy for each supported address representation."""
    assert is_safe_ip(ipaddress.ip_address(address)) is expected


def test_public_embedded_address_does_not_allow_6to4() -> None:
    """Public embedded IPv4 addresses do not enable this address form."""
    address: ipaddress.IPv6Address = ipaddress.IPv6Address("2002:808:808::1")
    assert address.sixtofour == ipaddress.IPv4Address("8.8.8.8")
    assert is_safe_ip(ipaddress.IPv4Address("8.8.8.8"))
    assert not is_safe_ip(address)


def test_public_resolution_deduplicates_and_rejects_any_unsafe_answer() -> None:
    from superset.utils.network import NonPublicAddressError, resolve_public_addresses

    answers: list[tuple[int, int, int, str, tuple[str, int]]] = [
        (2, 1, 6, "", ("8.8.8.8", 443))
    ] * 2
    with patch("superset.utils.network.socket.getaddrinfo", return_value=answers):
        assert resolve_public_addresses("fixture.test", 443, timeout=1) == ["8.8.8.8"]
    answers.append((2, 1, 6, "", ("127.0.0.1", 443)))
    with (
        patch("superset.utils.network.socket.getaddrinfo", return_value=answers),
        pytest.raises(NonPublicAddressError),
    ):
        resolve_public_addresses("fixture.test", 443, timeout=1)


def test_pinned_connection_does_not_repeat_dns_lookup() -> None:
    from contextvars import Token

    from superset.utils.network import (
        _PinnedHTTPSConnection,
        ConnectionDeadline,
        PROVIDER_DEADLINE,
    )

    bound: MagicMock = MagicMock()
    bound.remaining.return_value = 1
    connection: _PinnedHTTPSConnection = _PinnedHTTPSConnection("fixture.test", 443)
    assert connection._dns_host == "fixture.test"
    assert callable(connection._new_conn)
    with (
        patch(
            "superset.utils.network.socket.getaddrinfo",
            side_effect=[
                [(2, 1, 6, "", ("8.8.8.8", 443))],
                [(2, 1, 6, "", ("127.0.0.1", 443))],
            ],
        ) as resolve,
        patch("superset.utils.network._connect_address") as connect,
    ):
        token: Token[ConnectionDeadline | None] = PROVIDER_DEADLINE.set(bound)
        try:
            assert connection._new_conn() is connect.return_value
        finally:
            PROVIDER_DEADLINE.reset(token)
    resolve.assert_called_once()
    connect.assert_called_once_with(("8.8.8.8", 443), 1, connection.socket_options)
    bound.watch.assert_called_once_with(connect.return_value)
    assert (
        connection.host == "fixture.test"
    )  # Original hostname remains available to TLS.


def test_failed_socket_registration_closes_connected_socket() -> None:
    from contextvars import Token

    from urllib3.exceptions import NewConnectionError

    from superset.utils.network import (
        _PinnedHTTPSConnection,
        ConnectionDeadline,
        PROVIDER_DEADLINE,
    )

    bound: MagicMock = MagicMock()
    bound.remaining.return_value = 1
    bound.watch.side_effect = OSError("descriptor limit")
    connection: _PinnedHTTPSConnection = _PinnedHTTPSConnection("fixture.test", 443)
    with (
        patch("superset.utils.network._resolve_addresses", return_value=["8.8.8.8"]),
        patch("superset.utils.network._connect_address") as connect,
    ):
        token: Token[ConnectionDeadline | None] = PROVIDER_DEADLINE.set(bound)
        try:
            with pytest.raises(NewConnectionError):
                connection._new_conn()
        finally:
            PROVIDER_DEADLINE.reset(token)
        connect.return_value.close.assert_called_once()


def test_empty_resolution_fails_without_connecting() -> None:
    from superset.utils.network import resolve_public_addresses

    with (
        patch("superset.utils.network.socket.getaddrinfo", return_value=[]),
        patch("superset.utils.network._connect_address") as connect,
    ):
        with pytest.raises(OSError, match="No destination address"):
            resolve_public_addresses("fixture.test", 443, timeout=1)
        connect.assert_not_called()


@pytest.mark.parametrize("option_fails", [False, True])
def test_pinned_connect_applies_socket_options_before_connect(
    option_fails: bool,
) -> None:
    import socket

    from superset.utils.network import _connect_address

    with patch("superset.utils.network.socket.socket") as factory:
        sock: MagicMock = factory.return_value
        if option_fails:
            sock.setsockopt.side_effect = OSError("option rejected")
            with pytest.raises(OSError, match="option rejected"):
                _connect_address(
                    ("127.0.0.1", 443), 1, [(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)]
                )
            sock.connect.assert_not_called()
            sock.close.assert_called_once()
        else:
            assert (
                _connect_address(
                    ("127.0.0.1", 443), 1, [(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)]
                )
                is sock
            )
            assert [call[0] for call in sock.mock_calls] == [
                "settimeout",
                "setsockopt",
                "connect",
            ]
            sock.setsockopt.assert_called_once_with(
                socket.IPPROTO_TCP, socket.TCP_NODELAY, 1
            )


def test_resolver_bounds_timed_out_queued_submissions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Timeouts retain their slots until workers drain the submitted lookups."""
    from concurrent.futures import ThreadPoolExecutor
    from threading import BoundedSemaphore, Event

    from superset.utils import network

    release: Event = Event()
    slots: BoundedSemaphore = BoundedSemaphore(2)
    monkeypatch.setattr(network, "_RESOLVER_SLOTS", slots, raising=False)

    def resolve(*args: object) -> list[tuple[None, None, None, None, tuple[str, int]]]:
        assert release.wait(5)
        return [(None, None, None, None, ("8.8.8.8", 443))]

    monkeypatch.setattr(network.socket, "getaddrinfo", resolve)
    executor: ThreadPoolExecutor
    with ThreadPoolExecutor(1) as executor:
        monkeypatch.setattr(network, "_RESOLVER", executor)
        submit: MagicMock
        with patch.object(executor, "submit", wraps=executor.submit) as submit:
            try:
                _attempt: int
                for _attempt in range(10):
                    with pytest.raises(TimeoutError):
                        network.resolve_public_addresses(
                            "fixture.test", 443, timeout=0.01
                        )
                assert submit.call_count == 2
            finally:
                release.set()
        executor.shutdown(wait=True)
    # Completion, not the caller timeout, returned both slots.
    assert slots.acquire(blocking=False)
    assert slots.acquire(blocking=False)
    assert not slots.acquire(blocking=False)
    slots.release()
    slots.release()


def test_resolver_submission_failure_returns_capacity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An executor refusing submission must not strand an admission slot."""
    from concurrent.futures import ThreadPoolExecutor
    from threading import BoundedSemaphore

    from superset.utils import network

    slots: BoundedSemaphore = BoundedSemaphore(1)
    executor: ThreadPoolExecutor
    with ThreadPoolExecutor(1) as executor:
        executor.shutdown(wait=True)
    monkeypatch.setattr(network, "_RESOLVER", executor)
    monkeypatch.setattr(network, "_RESOLVER_SLOTS", slots)
    with pytest.raises(RuntimeError, match="cannot schedule"):
        network.resolve_public_addresses("fixture.test", 443, timeout=1)
    assert slots.acquire(blocking=False)
    slots.release()
