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

from typing import Iterator

import pytest
from sqlalchemy.orm.session import Session

from superset.databases.ssh_tunnel.commands.exceptions import SSHTunnelInvalidError


@pytest.fixture
def session_with_data(session: Session) -> Iterator[Session]:
    from superset.connectors.sqla.models import SqlaTable
    from superset.databases.ssh_tunnel.models import SSHTunnel
    from superset.models.core import Database

    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    db = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    sqla_table = SqlaTable(
        table_name="my_sqla_table",
        columns=[],
        metrics=[],
        database=db,
    )
    ssh_tunnel = SSHTunnel(database_id=db.id, database=db, server_address="Test")

    session.add(db)
    session.add(sqla_table)
    session.add(ssh_tunnel)
    session.flush()
    yield session
    session.rollback()


def test_update_shh_tunnel_command(session_with_data: Session) -> None:
    from superset.databases.dao import DatabaseDAO
    from superset.databases.ssh_tunnel.commands.update import UpdateSSHTunnelCommand
    from superset.databases.ssh_tunnel.models import SSHTunnel

    result = DatabaseDAO.get_ssh_tunnel(1)

    assert result
    assert isinstance(result, SSHTunnel)
    assert 1 == result.database_id
    assert "Test" == result.server_address

    update_payload = {"server_address": "Test2"}
    UpdateSSHTunnelCommand(1, update_payload).run()

    result = DatabaseDAO.get_ssh_tunnel(1)

    assert result
    assert isinstance(result, SSHTunnel)
    assert "Test2" == result.server_address


def test_update_shh_tunnel_invalid_params(session_with_data: Session) -> None:
    from superset.databases.dao import DatabaseDAO
    from superset.databases.ssh_tunnel.commands.update import UpdateSSHTunnelCommand
    from superset.databases.ssh_tunnel.models import SSHTunnel

    result = DatabaseDAO.get_ssh_tunnel(1)

    assert result
    assert isinstance(result, SSHTunnel)
    assert 1 == result.database_id
    assert "Test" == result.server_address

    # If we are trying to update a tunnel with a private_key_password
    # then a private_key is mandatory
    update_payload = {"private_key_password": "pass"}
    command = UpdateSSHTunnelCommand(1, update_payload)

    with pytest.raises(SSHTunnelInvalidError) as excinfo:
        command.run()
    assert str(excinfo.value) == ("SSH Tunnel parameters are invalid.")
