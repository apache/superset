#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.

from typing import Any

from superset.constants import PASSWORD_MASK
from superset.databases.ssh_tunnel.models import SSHTunnel

DEFAULT_PORTS: dict[str, int] = {
    "postgresql": 5432,
    "mysql": 3306,
    "oracle": 1521,
    "mssql": 1433,
}


def mask_password_info(ssh_tunnel: dict[str, Any]) -> dict[str, Any]:
    if ssh_tunnel.pop("password", None) is not None:
        ssh_tunnel["password"] = PASSWORD_MASK
    if ssh_tunnel.pop("private_key", None) is not None:
        ssh_tunnel["private_key"] = PASSWORD_MASK
    if ssh_tunnel.pop("private_key_password", None) is not None:
        ssh_tunnel["private_key_password"] = PASSWORD_MASK
    return ssh_tunnel


def unmask_password_info(
    ssh_tunnel: dict[str, Any], model: SSHTunnel
) -> dict[str, Any]:
    if ssh_tunnel.get("password") == PASSWORD_MASK:
        ssh_tunnel["password"] = model.password
    if ssh_tunnel.get("private_key") == PASSWORD_MASK:
        ssh_tunnel["private_key"] = model.private_key
    if ssh_tunnel.get("private_key_password") == PASSWORD_MASK:
        ssh_tunnel["private_key_password"] = model.private_key_password
    return ssh_tunnel


def get_default_port(backend: str) -> int | None:
    """
    Get the default port for the given backend.
    """
    return DEFAULT_PORTS.get(backend)
