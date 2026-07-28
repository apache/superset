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
from paramiko import (
    ECDSAKey,
    Ed25519Key,
    PasswordRequiredException,
    PKey,
    RSAKey,
    SSHException,
)
from paramiko.pkey import UnknownKeyType

from superset.commands.database.ssh_tunnel.exceptions import (
    SSHTunnelDatabasePortError,
    SSHTunnelHostKeyVerificationError,
)
from superset.databases.utils import make_url_safe
from superset.utils.class_utils import load_class_from_name

if TYPE_CHECKING:
    from superset.databases.ssh_tunnel.models import SSHTunnel

logger = logging.getLogger(__name__)

# Order matters: paramiko's per-class loaders raise SSHException with vague
# "unpack requires 4 bytes" messages on type mismatches, so we try the more
# modern key types first (ed25519, ECDSA) and fall back to RSA, which is the
# most permissive parser and the historical default in this codebase.
_SSH_KEY_TYPES: tuple[type[PKey], ...] = (Ed25519Key, ECDSAKey, RSAKey)


def _load_private_key(pem: str, password: str | None) -> PKey:
    """Load a private key PEM regardless of algorithm (ed25519, ECDSA, RSA).

    paramiko 3.2+ has ``PKey.from_path()`` for polymorphic loading, but it
    requires a filesystem path; writing private key material to disk would be a
    security regression. Each per-class loader only accepts its own format, so
    iterate over the supported types on the in-memory ``StringIO`` and return
    the first that parses cleanly.
    """
    last_exc: SSHException | None = None
    for key_class in _SSH_KEY_TYPES:
        try:
            return key_class.from_private_key(StringIO(pem), password=password)
        except PasswordRequiredException:
            raise
        except SSHException as exc:
            last_exc = exc
    # NOTE: last_exc holds the error from the final attempt (RSAKey), not the
    # closest-matching type. For a corrupted ed25519 key, the appended message
    # reflects RSAKey's parse error; the full type list above still identifies
    # all types attempted.
    raise SSHException(
        "Unable to parse SSH private key as any of "
        f"{', '.join(k.__name__ for k in _SSH_KEY_TYPES)}: {last_exc}"
    ) from last_exc


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
        # validate=True so malformed characters raise instead of being silently
        # dropped, which could otherwise pin an unintended key value.
        key_bytes = base64.b64decode(key_b64, validate=True)
    except (binascii.Error, ValueError) as ex:
        raise ValueError("Host key base64 payload could not be decoded") from ex
    try:
        return paramiko.PKey.from_type_string(key_type, key_bytes)
    except (paramiko.SSHException, UnknownKeyType) as ex:
        raise ValueError(f"Host key could not be parsed: {ex}") from ex


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

    def _verify_host_key(self, ssh_tunnel: "SSHTunnel") -> "paramiko.PKey | None":
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

        :returns: the parsed expected host key when one is configured (so the caller
            can pin it on the tunnel's own connection), or ``None`` when no key is
            configured.
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
            return None

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

        return expected_key

    def create_tunnel(
        self,
        ssh_tunnel: "SSHTunnel",
        sqlalchemy_database_uri: str,
    ) -> sshtunnel.SSHTunnelForwarder:
        # Deferred import to break a circular import:
        # superset.utils.ssh_tunnel -> superset.databases.ssh_tunnel.models
        # -> superset.extensions -> superset.extensions.ssh (this module).
        from superset.utils.ssh_tunnel import get_default_port

        url = make_url_safe(sqlalchemy_database_uri)
        backend = url.get_backend_name()
        port = url.port or get_default_port(backend)
        if not port:
            raise SSHTunnelDatabasePortError()

        # Opt-in host-key verification runs before the tunnel is opened. It returns
        # the parsed expected key (or None) so we can also pin it on the tunnel's own
        # connection below.
        expected_host_key = self._verify_host_key(ssh_tunnel)

        params = {
            "ssh_address_or_host": (ssh_tunnel.server_address, ssh_tunnel.server_port),
            "ssh_username": ssh_tunnel.username,
            "remote_bind_address": (url.host, port),
            "local_bind_address": (self.local_bind_address,),
            "debug_level": logging.getLogger("flask_appbuilder").level,
        }

        if expected_host_key is not None:
            # Pin the expected key on the tunnel's own connection, so paramiko verifies
            # the host that actually carries traffic on the same transport. The probe
            # above and the tunnel open separate connections, so verifying only the
            # probe would leave a TOCTOU gap (DNS re-resolution, selective
            # interception); pinning here closes it.
            params["ssh_host_key"] = expected_host_key

        if ssh_tunnel.password:
            params["ssh_password"] = ssh_tunnel.password
        elif ssh_tunnel.private_key:
            params["ssh_pkey"] = _load_private_key(
                ssh_tunnel.private_key, ssh_tunnel.private_key_password
            )

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
