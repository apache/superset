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

    session.add(database)
    session.add(sqla_table)
    session.flush()
    yield session
    session.rollback()


def test_datasource_find_by_id_skip_base_filter(session_with_data: Session) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.dataset import DatasetDAO

    result = DatasetDAO.find_by_id(
        1,
        skip_base_filter=True,
    )

    assert result
    assert 1 == result.id
    assert "my_sqla_table" == result.table_name
    assert isinstance(result, SqlaTable)


def test_datasource_find_by_id_skip_base_filter_not_found(
    session_with_data: Session,
) -> None:
    from superset.daos.dataset import DatasetDAO

    result = DatasetDAO.find_by_id(
        125326326,
        skip_base_filter=True,
    )
    assert result is None


def test_datasource_find_by_ids_skip_base_filter(session_with_data: Session) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.dataset import DatasetDAO

    result = DatasetDAO.find_by_ids(
        [1, 125326326],
        skip_base_filter=True,
    )

    assert result
    assert [1] == list(map(lambda x: x.id, result))
    assert ["my_sqla_table"] == list(map(lambda x: x.table_name, result))
    assert isinstance(result[0], SqlaTable)


def test_datasource_find_by_ids_skip_base_filter_not_found(
    session_with_data: Session,
) -> None:
    from superset.daos.dataset import DatasetDAO

    result = DatasetDAO.find_by_ids(
        [125326326, 125326326125326326],
        skip_base_filter=True,
    )

    assert len(result) == 0
