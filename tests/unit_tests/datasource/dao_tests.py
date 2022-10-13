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

from superset.utils.core import DatasourceType


@pytest.fixture
def session_with_data(session: Session) -> Iterator[Session]:
    from superset.columns.models import Column
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.datasets.models import Dataset
    from superset.models.core import Database
    from superset.models.sql_lab import Query, SavedQuery
    from superset.tables.models import Table

    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    db = Database(database_name="my_database", sqlalchemy_uri="sqlite://")

    columns = [
        TableColumn(column_name="a", type="INTEGER"),
    ]

    sqla_table = SqlaTable(
        table_name="my_sqla_table",
        columns=columns,
        metrics=[],
        database=db,
    )

    query_obj = Query(
        client_id="foo",
        database=db,
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

    saved_query = SavedQuery(database=db, sql="select * from foo")

    table = Table(
        name="my_table",
        schema="my_schema",
        catalog="my_catalog",
        database=db,
        columns=[],
    )

    dataset = Dataset(
        database=table.database,
        name="positions",
        expression="""
SELECT array_agg(array[longitude,latitude]) AS position
FROM my_catalog.my_schema.my_table
""",
        tables=[table],
        columns=[
            Column(
                name="position",
                expression="array_agg(array[longitude,latitude])",
            ),
        ],
    )

    session.add(dataset)
    session.add(table)
    session.add(saved_query)
    session.add(query_obj)
    session.add(db)
    session.add(sqla_table)
    session.flush()
    yield session


def test_get_datasource_sqlatable(session_with_data: Session) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.datasource.dao import DatasourceDAO

    result = DatasourceDAO.get_datasource(
        datasource_type=DatasourceType.TABLE,
        datasource_id=1,
        session=session_with_data,
    )

    assert 1 == result.id
    assert "my_sqla_table" == result.table_name
    assert isinstance(result, SqlaTable)


def test_get_datasource_query(session_with_data: Session) -> None:
    from superset.datasource.dao import DatasourceDAO
    from superset.models.sql_lab import Query

    result = DatasourceDAO.get_datasource(
        datasource_type=DatasourceType.QUERY, datasource_id=1, session=session_with_data
    )

    assert result.id == 1
    assert isinstance(result, Query)


def test_get_datasource_saved_query(session_with_data: Session) -> None:
    from superset.datasource.dao import DatasourceDAO
    from superset.models.sql_lab import SavedQuery

    result = DatasourceDAO.get_datasource(
        datasource_type=DatasourceType.SAVEDQUERY,
        datasource_id=1,
        session=session_with_data,
    )

    assert result.id == 1
    assert isinstance(result, SavedQuery)


def test_get_datasource_sl_table(session_with_data: Session) -> None:
    from superset.datasource.dao import DatasourceDAO
    from superset.tables.models import Table

    # todo(hugh): This will break once we remove the dual write
    # update the datsource_id=1 and this will pass again
    result = DatasourceDAO.get_datasource(
        datasource_type=DatasourceType.SLTABLE,
        datasource_id=2,
        session=session_with_data,
    )

    assert result.id == 2
    assert isinstance(result, Table)


def test_get_datasource_sl_dataset(session_with_data: Session) -> None:
    from superset.datasets.models import Dataset
    from superset.datasource.dao import DatasourceDAO

    # todo(hugh): This will break once we remove the dual write
    # update the datsource_id=1 and this will pass again
    result = DatasourceDAO.get_datasource(
        datasource_type=DatasourceType.DATASET,
        datasource_id=2,
        session=session_with_data,
    )

    assert result.id == 2
    assert isinstance(result, Dataset)


def test_get_datasource_w_str_param(session_with_data: Session) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.datasets.models import Dataset
    from superset.datasource.dao import DatasourceDAO
    from superset.tables.models import Table

    assert isinstance(
        DatasourceDAO.get_datasource(
            datasource_type="table",
            datasource_id=1,
            session=session_with_data,
        ),
        SqlaTable,
    )

    assert isinstance(
        DatasourceDAO.get_datasource(
            datasource_type="sl_table",
            datasource_id=1,
            session=session_with_data,
        ),
        Table,
    )


def test_get_all_datasources(session_with_data: Session) -> None:
    from superset.connectors.sqla.models import SqlaTable

    result = SqlaTable.get_all_datasources(session=session_with_data)
    assert len(result) == 1


def test_not_found_datasource(session_with_data: Session) -> None:
    from superset.dao.exceptions import DatasourceNotFound
    from superset.datasource.dao import DatasourceDAO

    with pytest.raises(DatasourceNotFound):
        DatasourceDAO.get_datasource(
            datasource_type="table",
            datasource_id=500000,
            session=session_with_data,
        )
