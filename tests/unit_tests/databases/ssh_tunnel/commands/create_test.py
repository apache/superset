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


import pytest

from superset.commands.database.ssh_tunnel.exceptions import (
    SSHTunnelDatabasePortError,
    SSHTunnelInvalidError,
)


def test_create_ssh_tunnel_command() -> None:
    from superset.commands.database.ssh_tunnel.create import CreateSSHTunnelCommand
    from superset.databases.ssh_tunnel.models import SSHTunnel
    from superset.models.core import Database

    database = Database(
        id=1,
        database_name="my_database",
        sqlalchemy_uri="postgresql://u:p@localhost:5432/db",
    )

    properties = {
        "database": database,
        "server_address": "123.132.123.1",
        "server_port": "3005",
        "username": "foo",
        "password": "bar",
    }

    result = CreateSSHTunnelCommand(database, properties).run()

    assert result is not None
    assert isinstance(result, SSHTunnel)


def test_create_ssh_tunnel_command_invalid_params() -> None:
    from superset.commands.database.ssh_tunnel.create import CreateSSHTunnelCommand
    from superset.models.core import Database

    database = Database(
        id=1,
        database_name="my_database",
        sqlalchemy_uri="postgresql://u:p@localhost:5432/db",
    )

    # If we are trying to create a tunnel with a private_key_password
    # then a private_key is mandatory
    properties = {
        "database": database,
        "server_address": "123.132.123.1",
        "server_port": "3005",
        "username": "foo",
        "private_key_password": "bar",
    }

    command = CreateSSHTunnelCommand(database, properties)

    with pytest.raises(SSHTunnelInvalidError) as excinfo:
        command.run()
    assert str(excinfo.value) == ("SSH Tunnel parameters are invalid.")


def test_create_ssh_tunnel_command_no_port() -> None:
    from superset.commands.database.ssh_tunnel.create import CreateSSHTunnelCommand
    from superset.models.core import Database

    database = Database(
        id=1,
        database_name="my_database",
        sqlalchemy_uri="postgresql://u:p@localhost/db",
    )

    properties = {
        "database": database,
        "server_address": "123.132.123.1",
        "server_port": "3005",
        "username": "foo",
        "password": "bar",
    }

    command = CreateSSHTunnelCommand(database, properties)

    with pytest.raises(SSHTunnelDatabasePortError) as excinfo:
        command.run()
    assert str(excinfo.value) == (
        "A database port is required when connecting via SSH Tunnel."
    )
