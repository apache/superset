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
from unittest.mock import patch

import pytest

from superset.utils.network import is_safe_host


@pytest.mark.parametrize(
    "resolved_ip, expected",
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
        # IPv6 private → unsafe
        ("fc00::1", False),
        ("fe80::1", False),
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
