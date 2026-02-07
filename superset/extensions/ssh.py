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
from paramiko import DSSKey, ECDSAKey, Ed25519Key, PKey, RSAKey, SSHException

from superset.commands.database.ssh_tunnel.exceptions import SSHTunnelDatabasePortError
from superset.databases.utils import make_url_safe
from superset.utils.class_utils import load_class_from_name

if TYPE_CHECKING:
    from superset.databases.ssh_tunnel.models import SSHTunnel


class SSHManager:
    def __init__(self, app: Flask) -> None:
        super().__init__()
        self.local_bind_address = app.config["SSH_TUNNEL_LOCAL_BIND_ADDRESS"]
        sshtunnel.TUNNEL_TIMEOUT = app.config["SSH_TUNNEL_TIMEOUT_SEC"]
        sshtunnel.SSH_TIMEOUT = app.config["SSH_TUNNEL_PACKET_TIMEOUT_SEC"]

    @staticmethod
    def _load_private_key(key_str: str, password: str | None = None) -> PKey:
        """
        Load a private key from a string, automatically detecting the key type.

        Paramiko supports multiple key types (RSA, Ed25519, ECDSA, DSS).
        This method tries each type until one succeeds, enabling support for
        modern key formats without hardcoding specific key types.

        :param key_str: Private key content as a string
        :param password: Optional passphrase for encrypted keys
        :return: Loaded PKey instance
        :raises SSHException: If the key cannot be loaded with any supported type
        """
        key_file = StringIO(key_str)
        # Try key types in order of common usage
        # RSA: Most common, legacy standard
        # Ed25519: Modern, recommended by security best practices
        # ECDSA: Modern elliptic curve
        # DSS: Legacy DSA keys
        key_classes = [RSAKey, Ed25519Key, ECDSAKey, DSSKey]

        for key_class in key_classes:
            try:
                key_file.seek(0)  # Reset file pointer for each attempt
                return key_class.from_private_key(key_file, password)
            except SSHException:
                continue  # Try next key type

        # If all attempts fail, raise an error
        raise SSHException(
            "Unable to load private key. The key format is not recognized or is invalid. "
            "Supported formats: RSA, Ed25519, ECDSA, DSS."
        )

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
            private_key = self._load_private_key(
                ssh_tunnel.private_key, ssh_tunnel.private_key_password
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
