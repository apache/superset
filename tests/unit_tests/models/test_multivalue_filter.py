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
"""Stage B: the CONTAINS filter operator for multi-value (array) columns."""

from __future__ import annotations

import pytest
from flask import Flask
from pytest_mock import MockerFixture

from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.exceptions import QueryObjectValidationError
from superset.models.core import Database
from superset.superset_typing import QueryObjectDict
from superset.utils.core import FilterOperator


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


def _query_obj() -> QueryObjectDict:
    return {
        "granularity": None,
        "from_dttm": None,
        "to_dttm": None,
        "is_timeseries": False,
        "groupby": ["city"],
        "metrics": ["count"],
        "filter": [
            {
                "col": "skills",
                "op": FilterOperator.CONTAINS.value,
                "val": "Driver",
            }
        ],
        "columns": [],
    }


def test_contains_operator_is_registered() -> None:
    """The operator round-trips through the enum used to parse filter payloads."""
    assert FilterOperator("CONTAINS") is FilterOperator.CONTAINS
    assert FilterOperator.CONTAINS.value == "CONTAINS"


def test_contains_filter_unsupported_engine_raises(
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """On an engine without array support (sqlite) CONTAINS is rejected."""
    dataset = _make_dataset(mocker)
    with app.test_request_context():  # noqa: SIM117
        with pytest.raises(QueryObjectValidationError):
            dataset.get_query_str_extended(_query_obj(), mutate=False)


def test_contains_filter_generates_native_sql(
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """On a multi-value-capable engine CONTAINS compiles to the native call.

    The dataset compiles against sqlite (so no ClickHouse driver is needed), but
    its engine spec is ClickHouse, so the operator routes through
    ``ClickHouseEngineSpec.array_contains`` -> ``has(...)``. ``func.has`` renders
    the same regardless of dialect, which lets us assert on it here.
    """
    # Imported lazily: clickhouse.py touches app.config at import time, which
    # is unavailable at pytest collection once clickhouse-connect is installed.
    from superset.db_engine_specs.clickhouse import ClickHouseEngineSpec

    dataset = _make_dataset(mocker)
    mocker.patch.object(
        SqlaTable,
        "db_engine_spec",
        new=property(lambda self: ClickHouseEngineSpec),
    )

    with app.test_request_context():
        extended = dataset.get_query_str_extended(_query_obj(), mutate=False)
        sql = extended.sql

    assert "has(" in sql.lower()
    assert "driver" in sql.lower()
