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
from unittest.mock import Mock, patch

import paramiko
import pytest
import sshtunnel

from superset.commands.database.ssh_tunnel.exceptions import (
    SSHTunnelHostKeyVerificationError,
)
from superset.extensions.ssh import SSHManager, SSHManagerFactory


def _make_manager(strict: bool = False) -> SSHManager:
    """Build an ``SSHManager`` test instance with configurable strict checking."""
    app = Mock()
    app.config = {
        "SSH_TUNNEL_MAX_RETRIES": 2,
        "SSH_TUNNEL_LOCAL_BIND_ADDRESS": "127.0.0.1",
        "SSH_TUNNEL_TIMEOUT_SEC": 123.0,
        "SSH_TUNNEL_PACKET_TIMEOUT_SEC": 321.0,
        "SSH_TUNNEL_MANAGER_CLASS": "superset.extensions.ssh.SSHManager",
        "SSH_TUNNEL_STRICT_HOST_KEY_CHECKING": strict,
    }
    return SSHManager(app)


def _authorized_key(key: paramiko.PKey) -> str:
    """Render a paramiko key in authorized-key (``"<type> <base64>"``) form."""
    return f"{key.get_name()} {key.get_base64()}"


def _ssh_tunnel(server_host_key: str | None) -> Mock:
    """Create a mocked SSH tunnel with server connection fields populated."""
    tunnel = Mock()
    tunnel.server_address = "ssh.example.com"
    tunnel.server_port = 22
    tunnel.server_host_key = server_host_key
    return tunnel


def test_ssh_tunnel_timeout_setting() -> None:
    app = Mock()
    app.config = {
        "SSH_TUNNEL_MAX_RETRIES": 2,
        "SSH_TUNNEL_LOCAL_BIND_ADDRESS": "test",
        "SSH_TUNNEL_TIMEOUT_SEC": 123.0,
        "SSH_TUNNEL_PACKET_TIMEOUT_SEC": 321.0,
        "SSH_TUNNEL_MANAGER_CLASS": "superset.extensions.ssh.SSHManager",
    }
    factory = SSHManagerFactory()
    factory.init_app(app)
    assert sshtunnel.TUNNEL_TIMEOUT == 123.0
    assert sshtunnel.SSH_TIMEOUT == 321.0


@patch("superset.extensions.ssh.socket.create_connection")
@patch("superset.extensions.ssh.paramiko.Transport")
def test_verify_host_key_match(
    mock_transport_cls: Mock, mock_create_connection: Mock
) -> None:
    """The server presents the same key we expect: verification passes."""
    server_key = paramiko.RSAKey.generate(2048)
    manager = _make_manager(strict=False)
    tunnel = _ssh_tunnel(_authorized_key(server_key))

    transport = mock_transport_cls.return_value
    transport.get_remote_server_key.return_value = server_key

    result = manager._verify_host_key(tunnel)  # should not raise

    # The TCP connect is bounded by an explicit timeout, and the resulting
    # socket is handed to Transport.
    mock_create_connection.assert_called_once_with(
        ("ssh.example.com", 22), timeout=321.0
    )
    mock_transport_cls.assert_called_once_with(mock_create_connection.return_value)
    transport.start_client.assert_called_once()
    transport.close.assert_called_once()
    # The parsed expected key is returned so the caller can pin it on the tunnel.
    assert result == server_key


@patch("superset.extensions.ssh.socket.create_connection")
@patch("superset.extensions.ssh.paramiko.Transport")
def test_verify_host_key_mismatch_raises(
    mock_transport_cls: Mock, mock_create_connection: Mock
) -> None:
    """The server presents a different key than expected: verification fails."""
    expected_key = paramiko.RSAKey.generate(2048)
    presented_key = paramiko.RSAKey.generate(2048)
    manager = _make_manager(strict=False)
    tunnel = _ssh_tunnel(_authorized_key(expected_key))

    transport = mock_transport_cls.return_value
    transport.get_remote_server_key.return_value = presented_key

    with pytest.raises(SSHTunnelHostKeyVerificationError):
        manager._verify_host_key(tunnel)

    mock_create_connection.assert_called_once()
    transport.close.assert_called_once()


@patch("superset.extensions.ssh.socket.create_connection")
def test_verify_host_key_connect_failure_raises(
    mock_create_connection: Mock,
) -> None:
    """A bounded TCP connect failure surfaces as a host-key verification error."""
    manager = _make_manager(strict=False)
    server_key = paramiko.RSAKey.generate(2048)
    tunnel = _ssh_tunnel(_authorized_key(server_key))

    mock_create_connection.side_effect = OSError("connection refused")

    with pytest.raises(SSHTunnelHostKeyVerificationError):
        manager._verify_host_key(tunnel)


@patch("superset.extensions.ssh.paramiko.Transport")
def test_verify_host_key_unset_non_strict_skips(mock_transport_cls: Mock) -> None:
    """Back-compat: no expected key + strict checking off => no verification at all."""
    manager = _make_manager(strict=False)
    tunnel = _ssh_tunnel(None)

    assert manager._verify_host_key(tunnel) is None  # should not raise

    mock_transport_cls.assert_not_called()


@patch("superset.extensions.ssh.paramiko.Transport")
def test_verify_host_key_unset_strict_raises(mock_transport_cls: Mock) -> None:
    """Fail-closed: no expected key + strict checking on => reject."""
    manager = _make_manager(strict=True)
    tunnel = _ssh_tunnel(None)

    with pytest.raises(SSHTunnelHostKeyVerificationError):
        manager._verify_host_key(tunnel)

    mock_transport_cls.assert_not_called()


@patch("superset.extensions.ssh.socket.create_connection")
@patch("superset.extensions.ssh.paramiko.Transport")
def test_verify_host_key_match_ignores_comment_and_whitespace(
    mock_transport_cls: Mock,
    mock_create_connection: Mock,
) -> None:
    # The stored key may carry a trailing comment and extra whitespace.
    server_key = paramiko.RSAKey.generate(2048)
    manager = _make_manager(strict=False)
    stored = f"  {_authorized_key(server_key)} user@host  "
    tunnel = _ssh_tunnel(stored)

    transport = mock_transport_cls.return_value
    transport.get_remote_server_key.return_value = server_key

    manager._verify_host_key(tunnel)  # should not raise

    # Whitespace/comment stripping must not short-circuit verification: the
    # bounded TCP connect and Transport handshake still run as in the plain
    # match case.
    mock_create_connection.assert_called_once_with(
        ("ssh.example.com", 22), timeout=321.0
    )
    mock_transport_cls.assert_called_once_with(mock_create_connection.return_value)
    transport.start_client.assert_called_once()
    transport.close.assert_called_once()


def test_verify_host_key_invalid_expected_raises() -> None:
    # A malformed expected key is rejected before any network connection.
    manager = _make_manager(strict=False)
    tunnel = _ssh_tunnel("not-a-valid-key")

    with pytest.raises(SSHTunnelHostKeyVerificationError):
        manager._verify_host_key(tunnel)


def test_verify_host_key_unknown_key_type_raises() -> None:
    """An unsupported key type is wrapped in the verification error, not leaked."""
    manager = _make_manager(strict=False)
    server_key = paramiko.RSAKey.generate(2048)
    tunnel = _ssh_tunnel(f"ssh-bogus {server_key.get_base64()}")

    with pytest.raises(SSHTunnelHostKeyVerificationError):
        manager._verify_host_key(tunnel)


@patch("superset.extensions.ssh.sshtunnel.open_tunnel")
@patch("superset.extensions.ssh.socket.create_connection")
@patch("superset.extensions.ssh.paramiko.Transport")
def test_create_tunnel_pins_verified_host_key(
    mock_transport_cls: Mock,
    mock_create_connection: Mock,
    mock_open_tunnel: Mock,
) -> None:
    """A verified expected key is also pinned on the tunnel's own connection.

    When an expected host key is configured and verified, it is also pinned on the
    tunnel's own connection (``ssh_host_key``) so paramiko verifies the host that
    actually carries traffic on the same transport — closing the probe-vs-tunnel
    TOCTOU gap rather than trusting only the pre-flight probe.
    """
    server_key = paramiko.RSAKey.generate(2048)
    manager = _make_manager(strict=False)
    tunnel = _ssh_tunnel(_authorized_key(server_key))
    tunnel.username = "user"
    tunnel.password = None
    tunnel.private_key = None

    mock_transport_cls.return_value.get_remote_server_key.return_value = server_key

    manager.create_tunnel(tunnel, "postgresql://u:p@db:5432/ex")

    _, kwargs = mock_open_tunnel.call_args
    assert kwargs["ssh_host_key"] == server_key


@patch("superset.extensions.ssh.sshtunnel.open_tunnel")
def test_create_tunnel_without_host_key_does_not_pin(mock_open_tunnel: Mock) -> None:
    # No expected key configured (non-strict): nothing is pinned, preserving the
    # prior behavior.
    manager = _make_manager(strict=False)
    tunnel = _ssh_tunnel(None)
    tunnel.username = "user"
    tunnel.password = None
    tunnel.private_key = None

    manager.create_tunnel(tunnel, "postgresql://u:p@db:5432/ex")

    _, kwargs = mock_open_tunnel.call_args
    assert "ssh_host_key" not in kwargs


def test_ssh_tunnel_schema_round_trips_server_host_key() -> None:
    """The schema accepts and preserves the public host key field."""
    from superset.databases.schemas import DatabaseSSHTunnel

    server_key = paramiko.RSAKey.generate(2048)
    authorized = _authorized_key(server_key)
    payload = {
        "server_address": "ssh.example.com",
        "server_port": 22,
        "username": "user",
        "password": "secret",
        "server_host_key": authorized,
    }
    loaded = DatabaseSSHTunnel().load(payload)
    assert loaded["server_host_key"] == authorized
