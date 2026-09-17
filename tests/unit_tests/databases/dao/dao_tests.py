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

from collections.abc import Iterator

import pytest
from sqlalchemy.orm.session import Session


@pytest.fixture
def session_with_data(session: Session) -> Iterator[Session]:
    from superset.connectors.sqla.models import SqlaTable
    from superset.databases.ssh_tunnel.models import SSHTunnel
    from superset.models.core import Database

    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    sqla_table = SqlaTable(
        table_name="my_sqla_table",
        columns=[],
        metrics=[],
        database=database,
    )
    ssh_tunnel = SSHTunnel(
        database_id=database.id,
        database=database,
    )

    session.add(database)
    session.add(sqla_table)
    session.add(ssh_tunnel)
    session.flush()
    yield session
    session.rollback()


def test_database_get_ssh_tunnel(session_with_data: Session) -> None:
    from superset.daos.database import DatabaseDAO
    from superset.databases.ssh_tunnel.models import SSHTunnel

    result = DatabaseDAO.get_ssh_tunnel(1)

    assert result
    assert isinstance(result, SSHTunnel)
    assert 1 == result.database_id


def test_database_get_ssh_tunnel_not_found(session_with_data: Session) -> None:
    from superset.daos.database import DatabaseDAO

    result = DatabaseDAO.get_ssh_tunnel(2)

    assert result is None
