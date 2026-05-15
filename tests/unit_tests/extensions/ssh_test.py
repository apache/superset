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

import sshtunnel
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
)

from superset.extensions.ssh import SSHManager, SSHManagerFactory


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


def _make_ed25519_pem() -> str:
    """Generate a fresh OpenSSH-format ed25519 private key PEM."""
    key = Ed25519PrivateKey.generate()
    return key.private_bytes(
        encoding=Encoding.PEM,
        format=PrivateFormat.OpenSSH,
        encryption_algorithm=NoEncryption(),
    ).decode()


def test_create_tunnel_accepts_ed25519_private_key() -> None:
    """
    Regression for #24180: ed25519 SSH keys must be loadable for tunnel
    setup. The bug surfaces as ``unpack requires 4 bytes`` because the
    code unconditionally calls ``RSAKey.from_private_key`` regardless of
    key type, which mis-parses the ed25519 byte stream.

    The Superset UI accepts any key the user pastes, so the fix is to
    detect the key type (or use ``paramiko.PKey.from_private_key`` once
    paramiko exposes a polymorphic loader) rather than hard-coding RSA.

    This test exercises ``create_tunnel`` end-to-end with a freshly
    generated ed25519 key. It mocks ``sshtunnel.open_tunnel`` so the
    test does not actually open a network connection — only the key
    parsing path is exercised.
    """
    app = Mock()
    app.config = {
        "SSH_TUNNEL_LOCAL_BIND_ADDRESS": "127.0.0.1",
        "SSH_TUNNEL_TIMEOUT_SEC": 10.0,
        "SSH_TUNNEL_PACKET_TIMEOUT_SEC": 10.0,
    }
    manager = SSHManager(app)

    ssh_tunnel = Mock()
    ssh_tunnel.server_address = "ssh.example.com"
    ssh_tunnel.server_port = 22
    ssh_tunnel.username = "tunneluser"
    ssh_tunnel.password = None
    ssh_tunnel.private_key = _make_ed25519_pem()
    ssh_tunnel.private_key_password = None

    with patch("superset.extensions.ssh.sshtunnel.open_tunnel") as mock_open:
        manager.create_tunnel(
            ssh_tunnel, "postgresql://user:pass@db.example.com:5432/x"
        )

    # Key-type-agnostic loader must produce a paramiko PKey usable as ssh_pkey.
    assert mock_open.called, "open_tunnel was never invoked — key parsing aborted"
    forwarded_pkey = mock_open.call_args.kwargs["ssh_pkey"]
    assert forwarded_pkey is not None


def test_create_tunnel_accepts_rsa_private_key_unchanged() -> None:
    """
    Companion to test_create_tunnel_accepts_ed25519_private_key: pin the
    backward-compatible RSA path so a fix for ed25519 doesn't regress the
    historically-supported RSA case. Uses a freshly generated RSA key in
    OpenSSH format.
    """
    from cryptography.hazmat.primitives.asymmetric.rsa import generate_private_key

    rsa_pem = (
        generate_private_key(public_exponent=65537, key_size=2048)
        .private_bytes(
            encoding=Encoding.PEM,
            format=PrivateFormat.OpenSSH,
            encryption_algorithm=NoEncryption(),
        )
        .decode()
    )

    app = Mock()
    app.config = {
        "SSH_TUNNEL_LOCAL_BIND_ADDRESS": "127.0.0.1",
        "SSH_TUNNEL_TIMEOUT_SEC": 10.0,
        "SSH_TUNNEL_PACKET_TIMEOUT_SEC": 10.0,
    }
    manager = SSHManager(app)

    ssh_tunnel = Mock()
    ssh_tunnel.server_address = "ssh.example.com"
    ssh_tunnel.server_port = 22
    ssh_tunnel.username = "tunneluser"
    ssh_tunnel.password = None
    ssh_tunnel.private_key = rsa_pem
    ssh_tunnel.private_key_password = None

    with patch("superset.extensions.ssh.sshtunnel.open_tunnel") as mock_open:
        manager.create_tunnel(
            ssh_tunnel, "postgresql://user:pass@db.example.com:5432/x"
        )

    assert mock_open.called
    assert mock_open.call_args.kwargs["ssh_pkey"] is not None
