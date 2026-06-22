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
"""Explode (group by array elements) for multi-value columns — ClickHouse MVP.

Set-returning UNNEST dialects (Postgres/Trino/BigQuery) need CROSS JOIN UNNEST
plumbing and are handled in a later phase; here we cover the scalar ClickHouse
``arrayJoin`` path plus the guard that keeps unimplemented dialects from emitting
invalid SQL.
"""

from __future__ import annotations

import pytest
from flask import Flask
from pytest_mock import MockerFixture

from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.db_engine_specs.base import BaseEngineSpec
from superset.exceptions import QueryObjectValidationError
from superset.models.core import Database
from superset.superset_typing import QueryObjectDict
from superset.utils.core import MultiValueColumnOperation


class _UnnestOnlySpec(BaseEngineSpec):
    """Simulates a future array dialect that has not implemented scalar explode."""

    supports_multivalue_columns = True
    # array_explode intentionally left as the base NotImplementedError


def _make_dataset(mocker: MockerFixture) -> SqlaTable:
    database = Database(
        id=1,
        database_name="test_db",
        sqlalchemy_uri="sqlite://",
    )
    columns = [
        TableColumn(column_name="skills", type="Array(String)"),
        TableColumn(column_name="city", type="VARCHAR(100)"),
    ]
    dataset = SqlaTable(
        table_name="jobs",
        columns=columns,
        database=database,
        metrics=[SqlMetric(metric_name="count", expression="COUNT(*)")],
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[],
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.is_guest_user",
        return_value=False,
    )
    return dataset


def _explode_dimension() -> dict:
    return {
        "label": "skill",
        "column": "skills",
        "columnOperation": MultiValueColumnOperation.EXPLODE.value,
    }


def _query_obj(dimension: dict) -> QueryObjectDict:
    return {
        "granularity": None,
        "from_dttm": None,
        "to_dttm": None,
        "is_timeseries": False,
        "groupby": [dimension],
        "metrics": ["count"],
        "filter": [],
        "columns": [],
    }


def _clickhouse_spec() -> type:
    # Imported lazily: clickhouse.py touches app.config at import time, which
    # is unavailable at pytest collection once clickhouse-connect is installed.
    from superset.db_engine_specs.clickhouse import ClickHouseEngineSpec

    return ClickHouseEngineSpec


def _with_spec(mocker: MockerFixture, dataset: SqlaTable, spec: type) -> None:
    mocker.patch.object(
        SqlaTable,
        "db_engine_spec",
        new=property(lambda self: spec),
    )


def test_explode_dimension_generates_arrayjoin(
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """An explode dimension routes through array_explode -> arrayJoin(skills)."""
    dataset = _make_dataset(mocker)
    _with_spec(mocker, dataset, _clickhouse_spec())
    with app.test_request_context():
        sql = dataset.get_query_str_extended(
            _query_obj(_explode_dimension()), mutate=False
        ).sql.lower()

    assert "arrayjoin(skills)" in sql
    assert "skill" in sql  # the label is applied


def test_explode_changes_generated_sql(
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """Exploding a column yields different SQL than grouping by it raw.

    The explode modifier is part of the query object, so a query that explodes
    cannot collide with one that does not (distinct cache keys downstream).
    """
    dataset = _make_dataset(mocker)
    _with_spec(mocker, dataset, _clickhouse_spec())
    with app.test_request_context():
        exploded = dataset.get_query_str_extended(
            _query_obj(_explode_dimension()), mutate=False
        ).sql
        plain = dataset.get_query_str_extended(_query_obj("city"), mutate=False).sql

    assert exploded != plain
    assert "arrayJoin" in exploded


def test_explode_unsupported_engine_raises(
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """On an engine without array support (sqlite) explode is rejected."""
    dataset = _make_dataset(mocker)
    with app.test_request_context():  # noqa: SIM117
        with pytest.raises(QueryObjectValidationError):
            dataset.get_sqla_query(**_query_obj(_explode_dimension()))


def test_explode_unimplemented_dialect_raises_clean_error(
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """A multi-value dialect lacking scalar explode gets a clear error, not bad SQL."""
    dataset = _make_dataset(mocker)
    _with_spec(mocker, dataset, _UnnestOnlySpec)
    with app.test_request_context():  # noqa: SIM117
        with pytest.raises(QueryObjectValidationError):
            dataset.adhoc_column_to_sqla(col=_explode_dimension())
