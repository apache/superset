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
    assert [1] == list(map(lambda x: x.id, result))  # noqa: C417
    assert ["my_sqla_table"] == list(map(lambda x: x.table_name, result))  # noqa: C417
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


def test_update_columns_and_metrics_apply_certification_metadata(
    session_with_data: Session,
) -> None:
    """
    The flat certification/warning keys that the dataset GET exposes are
    accepted by the PUT schema and written through to ``extra`` by the DAO,
    for both columns and metrics, and win over the same keys in ``extra``.
    """
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.daos.dataset import DatasetDAO
    from superset.datasets.schemas import DatasetPutSchema
    from superset.utils import json

    dataset = session_with_data.query(SqlaTable).one()
    dataset.columns = [TableColumn(column_name="ds", type="TIMESTAMP")]
    dataset.metrics = [SqlMetric(metric_name="cnt", expression="COUNT(*)")]
    session_with_data.flush()

    payload = DatasetPutSchema().load(
        {
            "columns": [
                {
                    "id": dataset.columns[0].id,
                    "column_name": "ds",
                    "extra": '{"certification": {"certified_by": "old"}}',
                    "certified_by": "Data Platform",
                    "certification_details": None,
                    "warning_markdown": "**warn**",
                    "is_certified": False,
                },
                {"column_name": "new_col", "certified_by": "Data Platform"},
            ],
            "metrics": [
                {
                    "id": dataset.metrics[0].id,
                    "metric_name": "cnt",
                    "expression": "COUNT(*)",
                    "certification_details": "Reviewed",
                    "is_certified": True,
                }
            ],
        }
    )
    DatasetDAO.update_columns(dataset, payload["columns"])
    DatasetDAO.update_metrics(dataset, payload["metrics"])
    session_with_data.flush()

    by_name = {
        c.column_name: c
        for c in session_with_data.query(TableColumn).filter_by(table_id=dataset.id)
    }
    # ``is_certified: False`` is the GET default; it must not undo the
    # certification set by the flat keys in the same payload.
    assert json.loads(by_name["ds"].extra) == {
        "certification": {"certified_by": "Data Platform"},
        "warning_markdown": "**warn**",
    }
    assert json.loads(by_name["new_col"].extra) == {
        "certification": {"certified_by": "Data Platform"}
    }
    assert json.loads(dataset.metrics[0].extra) == {
        "certification": {"details": "Reviewed"}
    }
