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

import base64
import binascii
import logging
import socket
from io import StringIO
from typing import TYPE_CHECKING

import paramiko
import sshtunnel
from flask import Flask
from paramiko import RSAKey

from superset.commands.database.ssh_tunnel.exceptions import (
    SSHTunnelDatabasePortError,
    SSHTunnelHostKeyVerificationError,
)
from superset.databases.utils import make_url_safe
from superset.utils.class_utils import load_class_from_name

if TYPE_CHECKING:
    from superset.databases.ssh_tunnel.models import SSHTunnel

logger = logging.getLogger(__name__)


def _parse_authorized_key(authorized_key: str) -> paramiko.PKey:
    """
    Parse a host key in authorized-key form (``"<type> <base64>[ comment]"``) into a
    :class:`paramiko.PKey`. The optional trailing comment field and surrounding
    whitespace are ignored.

    :raises ValueError: if the value is empty or cannot be parsed as a host key.
    """
    fields = authorized_key.strip().split()
    if len(fields) < 2:
        raise ValueError("Host key must be in 'ssh-<type> <base64>' form")
    key_type, key_b64 = fields[0], fields[1]
    try:
        key_bytes = base64.b64decode(key_b64)
    except (binascii.Error, ValueError) as ex:
        raise ValueError("Host key base64 payload could not be decoded") from ex
    return paramiko.PKey.from_type_string(key_type, key_bytes)


class SSHManager:
    def __init__(self, app: Flask) -> None:
        super().__init__()
        self.local_bind_address = app.config["SSH_TUNNEL_LOCAL_BIND_ADDRESS"]
        self.strict_host_key_checking = app.config.get(
            "SSH_TUNNEL_STRICT_HOST_KEY_CHECKING", False
        )
        sshtunnel.TUNNEL_TIMEOUT = app.config["SSH_TUNNEL_TIMEOUT_SEC"]
        sshtunnel.SSH_TIMEOUT = app.config["SSH_TUNNEL_PACKET_TIMEOUT_SEC"]

    def build_sqla_url(
        self, sqlalchemy_url: str, server: sshtunnel.SSHTunnelForwarder
    ) -> str:
        # override any ssh tunnel configuration object
        url = make_url_safe(sqlalchemy_url)
        return url.set(
            host=server.local_bind_address[0],
            port=server.local_bind_port,
        )

    def _verify_host_key(self, ssh_tunnel: "SSHTunnel") -> None:
        """
        Opt-in defense-in-depth: verify the SSH server's host key before opening the
        tunnel, to resist man-in-the-middle attacks (paramiko's ``Transport`` does no
        known-hosts checking by default).

        Behavior:

        - If the tunnel declares an expected ``server_host_key``, connect to the SSH
          server, read the host key it presents, and compare. On mismatch (or if the
          expected key cannot be parsed) raise
          :class:`SSHTunnelHostKeyVerificationError`.
        - If no expected key is set and ``SSH_TUNNEL_STRICT_HOST_KEY_CHECKING`` is
          enabled, fail closed and raise.
        - If no expected key is set and strict checking is disabled, do nothing,
          preserving existing (unverified) behavior.
        """
        expected_raw = ssh_tunnel.server_host_key

        if not expected_raw or not expected_raw.strip():
            if self.strict_host_key_checking:
                raise SSHTunnelHostKeyVerificationError(
                    message=(
                        "SSH_TUNNEL_STRICT_HOST_KEY_CHECKING is enabled but no "
                        "expected server host key is configured for this tunnel."
                    )
                )
            return

        try:
            expected_key = _parse_authorized_key(expected_raw)
        except ValueError as ex:
            raise SSHTunnelHostKeyVerificationError(
                message=f"The configured expected server host key is invalid: {ex}"
            ) from ex

        # Build the socket ourselves with an explicit timeout so the TCP connect
        # phase is bounded too. ``paramiko.Transport((host, port))`` would connect
        # synchronously with no timeout, leaving ``start_client(timeout=...)`` to
        # govern only the SSH handshake; an unreachable host could then block for the
        # full OS-level TCP timeout.
        try:
            sock = socket.create_connection(
                (ssh_tunnel.server_address, ssh_tunnel.server_port),
                timeout=sshtunnel.SSH_TIMEOUT,
            )
        except OSError as ex:
            raise SSHTunnelHostKeyVerificationError(
                message=f"Could not connect to the SSH server: {ex}"
            ) from ex

        transport = paramiko.Transport(sock)
        try:
            transport.start_client(timeout=sshtunnel.SSH_TIMEOUT)
            remote_key = transport.get_remote_server_key()
        except Exception as ex:  # noqa: BLE001
            raise SSHTunnelHostKeyVerificationError(
                message=f"Could not retrieve the SSH server host key: {ex}"
            ) from ex
        finally:
            transport.close()

        if remote_key != expected_key:
            logger.warning(
                "SSH host key mismatch for %s:%s",
                ssh_tunnel.server_address,
                ssh_tunnel.server_port,
            )
            raise SSHTunnelHostKeyVerificationError(
                message=(
                    "The SSH server presented a host key that does not match the "
                    "expected server host key configured for this tunnel."
                )
            )

    def create_tunnel(
        self,
        ssh_tunnel: "SSHTunnel",
        sqlalchemy_database_uri: str,
    ) -> sshtunnel.SSHTunnelForwarder:
        from superset.utils.ssh_tunnel import get_default_port

        url = make_url_safe(sqlalchemy_database_uri)
        backend = url.get_backend_name()
        port = url.port or get_default_port(backend)
        if not port:
            raise SSHTunnelDatabasePortError()

        # Opt-in host-key verification runs before the tunnel is opened.
        self._verify_host_key(ssh_tunnel)

        params = {
            "ssh_address_or_host": (ssh_tunnel.server_address, ssh_tunnel.server_port),
            "ssh_username": ssh_tunnel.username,
            "remote_bind_address": (url.host, port),
            "local_bind_address": (self.local_bind_address,),
            "debug_level": logging.getLogger("flask_appbuilder").level,
        }

        if ssh_tunnel.password:
            params["ssh_password"] = ssh_tunnel.password
        elif ssh_tunnel.private_key:
            private_key_file = StringIO(ssh_tunnel.private_key)
            private_key = RSAKey.from_private_key(
                private_key_file, ssh_tunnel.private_key_password
            )
            params["ssh_pkey"] = private_key

        return sshtunnel.open_tunnel(**params)


class SSHManagerFactory:
    def __init__(self) -> None:
        self._ssh_manager = None

    def init_app(self, app: Flask) -> None:
        self._ssh_manager = load_class_from_name(
            app.config["SSH_TUNNEL_MANAGER_CLASS"]
        )(app)

    @property
    def instance(self) -> SSHManager:
        return self._ssh_manager  # type: ignore
