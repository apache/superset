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
"""Stage D: the array-length virtual dimension for multi-value columns."""

from __future__ import annotations

import pytest
from flask import Flask
from pytest_mock import MockerFixture

from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.exceptions import QueryObjectValidationError
from superset.models.core import Database
from superset.superset_typing import AdhocColumn, Column, QueryObjectDict
from superset.utils.core import (
    GenericDataType,
    get_column_name_from_column,
    get_column_names_from_columns,
    MultiValueColumnOperation,
)


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


def _length_dimension() -> AdhocColumn:
    return {
        "label": "skills_length",
        "column": "skills",
        "columnOperation": MultiValueColumnOperation.LENGTH.value,
    }


def _query_obj(dimension: Column) -> QueryObjectDict:
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


def _clickhouse_dataset(mocker: MockerFixture) -> SqlaTable:
    # Imported lazily: clickhouse.py touches app.config at import time, which
    # is unavailable at pytest collection once clickhouse-connect is installed.
    from superset.db_engine_specs.clickhouse import ClickHouseEngineSpec

    dataset = _make_dataset(mocker)
    mocker.patch.object(
        SqlaTable,
        "db_engine_spec",
        new=property(lambda self: ClickHouseEngineSpec),
    )
    return dataset


def test_multivalue_column_not_treated_as_physical_column() -> None:
    """Regression: multi-value modifier columns must be ignored by the
    physical-column extraction used by query-context validation, otherwise they
    are wrongly reported as "Columns missing in dataset" on execution.
    """
    col = _length_dimension()
    assert get_column_name_from_column(col) is None
    assert get_column_names_from_columns([col, "city"]) == ["city"]


def test_length_dimension_generates_native_sql(
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """A length dimension routes through array_length -> length(skills)."""
    dataset = _clickhouse_dataset(mocker)
    with app.test_request_context():
        extended = dataset.get_query_str_extended(
            _query_obj(_length_dimension()), mutate=False
        )
        sql = extended.sql.lower()

    assert "length(skills)" in sql
    assert "skills_length" in sql  # the label is applied


def test_length_dimension_type_is_numeric(
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """The derived length column is typed NUMERIC so it behaves like a number."""
    dataset = _clickhouse_dataset(mocker)
    with app.test_request_context():
        _expr, generic_type = dataset.adhoc_column_to_sqla(col=_length_dimension())

    assert generic_type == GenericDataType.NUMERIC


def test_length_dimension_unsupported_engine_raises(
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """On an engine without array support (sqlite) the length op is rejected."""
    dataset = _make_dataset(mocker)
    with app.test_request_context():  # noqa: SIM117
        with pytest.raises(QueryObjectValidationError):
            dataset.get_query_str_extended(
                _query_obj(_length_dimension()), mutate=False
            )


def test_length_dimension_unknown_base_column_raises(
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """A length op referencing a missing base column is rejected."""
    dataset = _clickhouse_dataset(mocker)
    bad: AdhocColumn = {
        "label": "nope_length",
        "column": "does_not_exist",
        "columnOperation": MultiValueColumnOperation.LENGTH.value,
    }
    with app.test_request_context():  # noqa: SIM117
        with pytest.raises(QueryObjectValidationError):
            dataset.get_query_str_extended(_query_obj(bad), mutate=False)


def test_unsupported_operation_raises(
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """An unknown columnOperation is rejected rather than silently ignored."""
    dataset = _clickhouse_dataset(mocker)
    bad: AdhocColumn = {
        "label": "skills_x",
        "column": "skills",
        "columnOperation": "NOT_A_REAL_OP",
    }
    with app.test_request_context():  # noqa: SIM117
        with pytest.raises(QueryObjectValidationError):
            dataset.adhoc_column_to_sqla(col=bad)
