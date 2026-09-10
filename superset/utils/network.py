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
import platform
import socket
import subprocess
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.connection import HTTPConnection, HTTPSConnection
from urllib3.connectionpool import HTTPConnectionPool, HTTPSConnectionPool

# Networks that must never be reached via user-supplied hostnames.
# Includes loopback, RFC-1918 private ranges, link-local (covers cloud
# metadata endpoints such as 169.254.169.254), shared address space
# (RFC 6598, 100.64.0.0/10), multicast (ip.is_global returns True for
# multicast addresses in Python, so explicit blocking is required), and
# IPv6 equivalents.
_SSRF_UNSAFE_NETWORKS = (
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("224.0.0.0/4"),  # IPv4 multicast — is_global is True in Python
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("ff00::/8"),  # IPv6 multicast
)

PORT_TIMEOUT = 5
PING_TIMEOUT = 5


class SSRFProtectionError(ConnectionError):
    """
    Raised when an outbound request's connected peer is not a public,
    globally-routable address. Subclasses ``ConnectionError`` so it's
    already covered by any caller that catches connection failures broadly
    (and, when raised from within an active ``requests``/``urllib3``
    connection attempt, surfaces to callers as a
    ``requests.exceptions.ConnectionError``, since ``requests`` wraps
    whatever a connection class raises during ``connect()``).
    """


def _raise_for_unsafe_peer(conn: HTTPConnection) -> None:
    """
    Validate that a connection's actual peer is publicly routable.

    An upfront ``is_safe_host`` check resolves and validates the hostname
    once, ahead of time; the connection opened here is resolved
    independently and may reach a different address (DNS rebinding via a
    low-TTL record), so the check has to be repeated against the address
    actually connected to.
    """
    sock = conn.sock
    if sock is None:
        return
    peer = sock.getpeername()[0]
    if not is_safe_ip(ipaddress.ip_address(peer)):
        raise SSRFProtectionError("Request target host is not allowed.")


class _PeerValidatingHTTPConnection(HTTPConnection):
    """HTTP connection that validates the peer address on connect."""

    def connect(self) -> None:
        super().connect()
        _raise_for_unsafe_peer(self)


class _PeerValidatingHTTPSConnection(HTTPSConnection):
    """HTTPS connection that validates the peer address after the handshake."""

    def connect(self) -> None:
        super().connect()
        _raise_for_unsafe_peer(self)


class _PeerValidatingHTTPConnectionPool(HTTPConnectionPool):
    ConnectionCls = _PeerValidatingHTTPConnection


class _PeerValidatingHTTPSConnectionPool(HTTPSConnectionPool):
    ConnectionCls = _PeerValidatingHTTPSConnection


class PeerValidatingHTTPAdapter(HTTPAdapter):
    """
    Transport adapter that routes requests through connection classes which
    validate the connected peer address, closing the TOCTOU window between
    an upfront ``is_safe_host`` check and the connection ``send()`` actually
    opens.

    Mirrors the peer-validation approach already used for webhook alert/
    report dispatch (``superset.reports.notifications.webhook``) and
    dataset-import data URIs
    (``superset.commands.dataset.importers.v1.utils``); factored out here so
    other outbound-request call sites (e.g. OAuth2 token/authorization
    endpoints) can reuse it instead of re-implementing it.
    """

    def init_poolmanager(self, *args: Any, **kwargs: Any) -> None:
        super().init_poolmanager(*args, **kwargs)
        # Assign a new dict rather than mutating the manager's dict in
        # place -- the attribute otherwise aliases urllib3's module-global
        # default scheme-to-pool-class mapping.
        self.poolmanager.pool_classes_by_scheme = {
            "http": _PeerValidatingHTTPConnectionPool,
            "https": _PeerValidatingHTTPSConnectionPool,
        }


def get_ssrf_safe_requester(allow_unsafe_hosts: bool = False) -> Any:
    """
    Return a ``requests``-compatible object (the ``requests`` module, or a
    ``Session``) for making an outbound request to a host that isn't fully
    operator-controlled.

    The returned session's transport re-validates the actually-connected
    peer address on every request, closing the TOCTOU window an upfront
    ``is_safe_host`` check alone leaves open. Pass ``allow_unsafe_hosts=True``
    for deployments that intentionally target internal hosts (the caller is
    still expected to have made that an explicit, documented opt-in).
    """
    if allow_unsafe_hosts:
        return requests
    session = requests.Session()
    # Ignore HTTP(S)_PROXY / NO_PROXY from the environment. A proxied request
    # goes through Requests' separately built ProxyManager, whose pools never
    # use the peer-validating connection classes installed below -- and the
    # peer we'd see there is the proxy itself, not the target -- so the
    # rebinding check would be silently inactive. Deployments that must route
    # these calls through a proxy opt in via ``allow_unsafe_hosts`` (which
    # returns the plain ``requests`` module and honours the environment).
    session.trust_env = False
    adapter = PeerValidatingHTTPAdapter()
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


def is_safe_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """
    Return True if a single IP address is public and globally routable.

    IPv4-mapped IPv6 addresses (e.g. ``::ffff:127.0.0.1``) are unwrapped so
    they are checked against the IPv4 unsafe networks rather than bypassing
    them.
    """
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return ip.is_global and not any(ip in net for net in _SSRF_UNSAFE_NETWORKS)


def is_safe_host(host: str) -> bool:
    """
    Return True if ``host`` resolves exclusively to public, globally-routable
    IP addresses.

    Returns False if any resolved address falls within a private, loopback,
    link-local, or otherwise non-routable range.  An unresolvable host also
    returns False.

    Name resolution here is independent of the resolution performed when a
    connection is later opened, so callers that go on to fetch from ``host``
    should also validate the connected peer address (see ``is_safe_ip``).
    """
    try:
        results = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    if not results:
        return False
    for _, _, _, _, sockaddr in results:
        try:
            ip = ipaddress.ip_address(sockaddr[0])
        except ValueError:
            return False
        if not is_safe_ip(ip):
            return False
    return True


def is_port_open(host: str, port: int) -> bool:
    """
    Test if a given port in a host is open.
    """
    # pylint: disable=invalid-name
    for res in socket.getaddrinfo(host, port, 0, socket.SOCK_STREAM):
        af, _, _, _, sockaddr = res
        s = socket.socket(af, socket.SOCK_STREAM)
        try:
            s.settimeout(PORT_TIMEOUT)
            s.connect(sockaddr)
            s.shutdown(socket.SHUT_RDWR)
            return True
        except OSError as _:
            continue
        finally:
            s.close()
    return False


def is_hostname_valid(host: str) -> bool:
    """
    Test if a given hostname can be resolved.
    """
    try:
        socket.getaddrinfo(host, None)
        return True
    except socket.gaierror:
        return False


def is_host_up(host: str) -> bool:
    """
    Ping a host to see if it's up.

    Note that if we don't get a response the host might still be up,
    since many firewalls block ICMP packets.
    """
    param = "-n" if platform.system().lower() == "windows" else "-c"
    command = ["ping", param, "1", host]
    try:
        output = subprocess.call(command, timeout=PING_TIMEOUT)  # noqa: S603
    except subprocess.TimeoutExpired:
        return False

    return output == 0
