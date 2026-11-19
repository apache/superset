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
"""Database selection in the legacy cache-warming endpoint."""

import inspect
from unittest.mock import patch

import pytest
from flask import Flask
from sqlalchemy.orm import Session

from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.slice import Slice
from superset.views.core import Superset


@pytest.fixture
def cache_charts(session: Session) -> dict[str, Slice]:
    """Create datasets with overlapping names in separate databases."""
    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)

    charts = {}
    for identifier, name in enumerate(("warehouse_a", "warehouse_b"), start=1):
        session.execute(
            Database.__table__.insert().values(
                id=identifier, database_name=name, sqlalchemy_uri="sqlite://"
            )
        )
        session.execute(
            SqlaTable.__table__.insert().values(
                id=identifier, table_name="sales", database_id=identifier
            )
        )
        session.execute(
            Slice.__table__.insert().values(
                id=identifier,
                slice_name=name,
                datasource_id=identifier,
                datasource_type="table",
            )
        )
        charts[name] = session.query(Slice).filter_by(id=identifier).one()
    return charts


@pytest.mark.parametrize("database_name", ["warehouse_a", "warehouse_b"])
def test_warm_up_cache_matches_database_and_table(
    app: Flask, cache_charts: dict[str, Slice], database_name: str
) -> None:
    """Identically named datasets must not make cache warming ambiguous."""
    chart = cache_charts[database_name]
    with (
        app.test_request_context(
            query_string={"db_name": database_name, "table_name": "sales"}
        ),
        patch("superset.views.core.ChartWarmUpCacheCommand") as command,
    ):
        command.return_value.run.return_value = {"chart_id": chart.id}
        response = inspect.unwrap(Superset.warm_up_cache)(Superset())

    assert response.status_code == 200
    assert response.get_json() == [{"slice_id": chart.id}]
    command.assert_called_once_with(chart, None, None)
    command.return_value.run.assert_called_once_with(skip_disabled=True)


@pytest.mark.parametrize(
    "database_name, table_name",
    [("missing", "sales"), ("warehouse_a", "missing")],
)
def test_warm_up_cache_missing_dataset(
    app: Flask,
    cache_charts: dict[str, Slice],
    database_name: str,
    table_name: str,
) -> None:
    """A dataset must exist in the requested database before charts are warmed."""
    with (
        app.test_request_context(
            query_string={"db_name": database_name, "table_name": table_name}
        ),
        patch("superset.views.core.ChartWarmUpCacheCommand") as command,
    ):
        response = inspect.unwrap(Superset.warm_up_cache)(Superset())

    assert response.status_code == 404
    assert "wasn't found" in response.get_json()["error"]
    command.assert_not_called()
