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

import importlib
import logging
from io import StringIO
from typing import TYPE_CHECKING

from flask import Flask
from paramiko import RSAKey
from sshtunnel import open_tunnel, SSHTunnelForwarder

from superset.databases.utils import make_url_safe

if TYPE_CHECKING:
    from superset.databases.ssh_tunnel.models import SSHTunnel


class SSHManager:
    def __init__(self, app: Flask) -> None:
        super().__init__()
        self.local_bind_address = app.config["SSH_TUNNEL_LOCAL_BIND_ADDRESS"]

    def build_sqla_url(  # pylint: disable=no-self-use
        self, sqlalchemy_url: str, server: SSHTunnelForwarder
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
    ) -> SSHTunnelForwarder:
        url = make_url_safe(sqlalchemy_database_uri)
        params = {
            "ssh_address_or_host": (ssh_tunnel.server_address, ssh_tunnel.server_port),
            "ssh_username": ssh_tunnel.username,
            "remote_bind_address": (url.host, url.port),
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

        return open_tunnel(**params)


class SSHManagerFactory:
    def __init__(self) -> None:
        self._ssh_manager = None

    def init_app(self, app: Flask) -> None:
        ssh_manager_fqclass = app.config["SSH_TUNNEL_MANAGER_CLASS"]
        ssh_manager_classname = ssh_manager_fqclass[
            ssh_manager_fqclass.rfind(".") + 1 :
        ]
        ssh_manager_module_name = ssh_manager_fqclass[
            0 : ssh_manager_fqclass.rfind(".")
        ]
        ssh_manager_class = getattr(
            importlib.import_module(ssh_manager_module_name), ssh_manager_classname
        )

        self._ssh_manager = ssh_manager_class(app)

    @property
    def instance(self) -> SSHManager:
        return self._ssh_manager  # type: ignore
