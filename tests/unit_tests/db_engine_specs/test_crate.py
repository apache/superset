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
from datetime import datetime
from typing import Optional
from unittest.mock import Mock

import pandas as pd
import pytest

from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


def test_epoch_to_dttm() -> None:
    """
    DB Eng Specs (crate): Test epoch to dttm
    """
    from superset.db_engine_specs.crate import CrateEngineSpec

    assert CrateEngineSpec.epoch_to_dttm() == "{col} * 1000"


def test_epoch_ms_to_dttm() -> None:
    """
    DB Eng Specs (crate): Test epoch ms to dttm
    """
    from superset.db_engine_specs.crate import CrateEngineSpec

    assert CrateEngineSpec.epoch_ms_to_dttm() == "{col}"


@pytest.mark.parametrize(
    "column_type",
    [
        "TIMESTAMP",
        "TIMESTAMP WITHOUT TIME ZONE",
        "TIMESTAMP WITH TIME ZONE",
    ],
)
def test_alter_new_orm_column(column_type: str) -> None:
    """
    DB Eng Specs (crate): Test alter orm column
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.db_engine_specs.crate import CrateEngineSpec
    from superset.models.core import Database
    from superset.utils.core import DateColumn, normalize_dttm_col

    database = Database(database_name="crate", sqlalchemy_uri="crate://db")
    tbl = SqlaTable(table_name="tbl", database=database)
    col = TableColumn(column_name="ts", type=column_type, table=tbl)
    CrateEngineSpec.alter_new_orm_column(col)
    assert col.python_date_format == "epoch_ms"
    df = pd.DataFrame({"ts": [1704067200000, 1704153600000, None]})
    normalize_dttm_col(df, (DateColumn("ts", col.python_date_format),))
    assert df["ts"].iloc[:2].tolist() == [
        pd.Timestamp("2024-01-01"),
        pd.Timestamp("2024-01-02"),
    ]
    assert pd.isna(df["ts"].iloc[2])


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("TimeStamp", "CAST('2019-01-02T03:04:05.678900' AS TIMESTAMP)"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.crate import CrateEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize("column_type", ["DATE", "TIME", "BIGINT", "VARCHAR", None])
def test_alter_new_orm_column_preserves_other_types(column_type: str | None) -> None:
    """Non-timestamp columns must retain their configured date format."""
    from superset.connectors.sqla.models import TableColumn
    from superset.db_engine_specs.crate import CrateEngineSpec

    col = TableColumn(column_name="value", type=column_type, python_date_format="%Y")
    CrateEngineSpec.alter_new_orm_column(col)
    assert col.python_date_format == "%Y"


@pytest.mark.parametrize("type_code", [11, 15])
@pytest.mark.parametrize("date_format", [None, "", "epoch_ms"])
def test_fetch_timestamp_without_dataset_format(
    type_code: int, date_format: str | None
) -> None:
    """Old datasets normalize correctly without modifying their stored formats."""
    from superset.db_engine_specs.crate import CrateEngineSpec
    from superset.utils.core import DateColumn, normalize_dttm_col

    cursor = Mock()
    cursor.description = [("ts", None), ("n", None)]
    cursor._result = {"col_types": [type_code, 10]}
    cursor.fetchall.return_value = [
        (1704067200000, 1704067200000),
        (-1, 2),
        (None, 3),
    ]
    rows = CrateEngineSpec.fetch_data(cursor)
    assert rows == [
        (datetime(2024, 1, 1), 1704067200000),
        (datetime(1969, 12, 31, 23, 59, 59, 999000), 2),
        (None, 3),
    ]
    df = pd.DataFrame(rows, columns=["ts", "n"])
    normalize_dttm_col(df, (DateColumn("ts", date_format),))
    assert df["ts"].iloc[0] == pd.Timestamp("2024-01-01")
    assert pd.isna(df["ts"].iloc[2])


def test_fetch_timestamp_preserves_other_types_and_native_datetimes() -> None:
    """Only scalar timestamp wire values are converted, not integers or arrays."""
    from decimal import Decimal

    from superset.db_engine_specs.crate import CrateEngineSpec

    row = (
        datetime(2024, 1, 1),
        1704067200000,
        Decimal("1.000000000000000001"),
        [1704067200000],
    )
    cursor = Mock()
    cursor.description = [(str(i), None) for i in range(4)]
    cursor._result = {"col_types": [15, 10, 22, [100, 15]]}
    cursor.fetchall.return_value = [row]
    assert CrateEngineSpec.fetch_data(cursor) == [row]
    cursor._result = {}
    assert CrateEngineSpec.fetch_data(cursor) == [row]
