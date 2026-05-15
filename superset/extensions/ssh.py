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

import logging
from io import StringIO
from typing import TYPE_CHECKING

import sshtunnel
from flask import Flask
from paramiko import ECDSAKey, Ed25519Key, PKey, RSAKey, SSHException

from superset.commands.database.ssh_tunnel.exceptions import SSHTunnelDatabasePortError
from superset.databases.utils import make_url_safe
from superset.utils.class_utils import load_class_from_name

if TYPE_CHECKING:
    from superset.databases.ssh_tunnel.models import SSHTunnel

# Order matters: paramiko's per-class loaders raise SSHException with vague
# "unpack requires 4 bytes" messages on type mismatches, so we try the more
# modern key types first (ed25519, ECDSA) and fall back to RSA, which is the
# most permissive parser and the historical default in this codebase.
_SSH_KEY_TYPES: tuple[type[PKey], ...] = (Ed25519Key, ECDSAKey, RSAKey)


def _load_private_key(pem: str, password: str | None) -> PKey:
    """Load a private key PEM regardless of algorithm (ed25519, ECDSA, RSA).

    paramiko does not expose a polymorphic ``PKey.from_private_key``; each
    key class only accepts its own format. Iterate over the supported types
    and return the first that parses cleanly.
    """
    last_exc: Exception | None = None
    for key_class in _SSH_KEY_TYPES:
        try:
            return key_class.from_private_key(StringIO(pem), password=password)
        except SSHException as exc:
            last_exc = exc
            continue
    raise SSHException(
        "Unable to parse SSH private key as any of "
        f"{', '.join(k.__name__ for k in _SSH_KEY_TYPES)}: {last_exc}"
    )


class SSHManager:
    def __init__(self, app: Flask) -> None:
        super().__init__()
        self.local_bind_address = app.config["SSH_TUNNEL_LOCAL_BIND_ADDRESS"]
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
