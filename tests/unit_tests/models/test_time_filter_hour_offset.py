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
"""Tests that the dataset Hour Offset is honored by the time filter (#104810)."""

from __future__ import annotations

from datetime import datetime

from flask import Flask
from pytest_mock import MockerFixture

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.models.core import Database
from superset.superset_typing import QueryObjectDict


def _build_dataset(offset: int) -> SqlaTable:
    database = Database(
        id=1,
        database_name="test_db",
        sqlalchemy_uri="sqlite://",
    )
    columns = [
        TableColumn(column_name="dttm", is_dttm=1, type="TIMESTAMP"),
        TableColumn(column_name="value", type="INTEGER"),
    ]
    return SqlaTable(
        table_name="test_table",
        columns=columns,
        main_dttm_col="dttm",
        database=database,
        offset=offset,
    )


def _generated_sql(dataset: SqlaTable, mocker: MockerFixture, app: Flask) -> str:
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[],
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.is_guest_user",
        return_value=False,
    )
    query_obj: QueryObjectDict = {
        "granularity": "dttm",
        "from_dttm": datetime(2024, 1, 1),
        "to_dttm": datetime(2024, 1, 31),
        "is_timeseries": False,
        "filter": [
            {"col": "dttm", "op": "TEMPORAL_RANGE", "val": "2024-01-01 : 2024-01-31"}
        ],
        "metrics": [],
        "columns": ["value"],
    }
    with app.test_request_context():
        return dataset.get_query_str_extended(query_obj, mutate=False).sql


def test_time_filter_without_offset_uses_raw_bounds(
    mocker: MockerFixture, app: Flask
) -> None:
    sql = _generated_sql(_build_dataset(0), mocker, app)
    # The requested start bound (2024-01-01) is used verbatim; no day shift.
    assert "2024-01-01" in sql
    assert "2023-12-31" not in sql


def test_time_filter_shifts_bounds_by_dataset_hour_offset(
    mocker: MockerFixture, app: Flask
) -> None:
    # Offset of +4h: displayed values are value + 4h, so the filter bounds must
    # shift back by 4h. Start 2024-01-01 00:00 -> 2023-12-31 20:00 (#104810).
    sql = _generated_sql(_build_dataset(4), mocker, app)
    assert "2023-12-31 20:00:00" in sql
    # The unshifted start bound must NOT appear as the filter boundary.
    assert "2024-01-01 00:00:00" not in sql


def test_time_filter_negative_offset_shifts_forward(
    mocker: MockerFixture, app: Flask
) -> None:
    # Offset of -4h shifts the start bound forward to 2024-01-01 04:00.
    sql = _generated_sql(_build_dataset(-4), mocker, app)
    assert "2024-01-01 04:00:00" in sql
