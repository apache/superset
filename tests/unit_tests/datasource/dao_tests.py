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

from superset.utils.core import DatasourceType


@pytest.fixture
def session_with_data(session: Session) -> Iterator[Session]:
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database
    from superset.models.sql_lab import Query, SavedQuery

    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")

    columns = [
        TableColumn(column_name="a", type="INTEGER"),
    ]

    sqla_table = SqlaTable(
        table_name="my_sqla_table",
        columns=columns,
        metrics=[],
        database=database,
    )

    query_obj = Query(
        client_id="foo",
        database=database,
        tab_name="test_tab",
        sql_editor_id="test_editor_id",
        sql="select * from bar",
        select_sql="select * from bar",
        executed_sql="select * from bar",
        limit=100,
        select_as_cta=False,
        rows=100,
        error_message="none",
        results_key="abc",
    )

    saved_query = SavedQuery(database=database, sql="select * from foo")

    session.add(saved_query)
    session.add(query_obj)
    session.add(database)
    session.add(sqla_table)
    session.flush()
    return session


def test_get_datasource_sqlatable(session_with_data: Session) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.datasource import DatasourceDAO

    result = DatasourceDAO.get_datasource(
        datasource_type=DatasourceType.TABLE,
        datasource_id=1,
    )

    assert 1 == result.id
    assert "my_sqla_table" == result.table_name
    assert isinstance(result, SqlaTable)


def test_get_datasource_query(session_with_data: Session) -> None:
    from superset.daos.datasource import DatasourceDAO
    from superset.models.sql_lab import Query

    result = DatasourceDAO.get_datasource(
        datasource_type=DatasourceType.QUERY, datasource_id=1
    )

    assert result.id == 1
    assert isinstance(result, Query)


def test_get_datasource_saved_query(session_with_data: Session) -> None:
    from superset.daos.datasource import DatasourceDAO
    from superset.models.sql_lab import SavedQuery

    result = DatasourceDAO.get_datasource(
        datasource_type=DatasourceType.SAVEDQUERY,
        datasource_id=1,
    )

    assert result.id == 1
    assert isinstance(result, SavedQuery)


def test_get_datasource_w_str_param(session_with_data: Session) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.datasource import DatasourceDAO

    assert isinstance(
        DatasourceDAO.get_datasource(
            datasource_type="table",
            datasource_id=1,
        ),
        SqlaTable,
    )


def test_get_all_datasources(session_with_data: Session) -> None:
    from superset.connectors.sqla.models import SqlaTable

    result = SqlaTable.get_all_datasources()
    assert len(result) == 1


def test_not_found_datasource(session_with_data: Session) -> None:
    from superset.daos.datasource import DatasourceDAO
    from superset.daos.exceptions import DatasourceNotFound

    with pytest.raises(DatasourceNotFound):
        DatasourceDAO.get_datasource(
            datasource_type="table",
            datasource_id=500000,
        )
