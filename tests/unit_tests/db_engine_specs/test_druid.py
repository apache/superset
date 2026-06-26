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
from unittest import mock

import pandas as pd
import pytest
from sqlalchemy import column

from superset.db_engine_specs.base import BaseEngineSpec
from superset.result_set import SupersetResultSet
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "CAST(TIME_PARSE('2019-01-02') AS DATE)"),
        ("DateTime", "TIME_PARSE('2019-01-02T03:04:05')"),
        ("TimeStamp", "TIME_PARSE('2019-01-02T03:04:05')"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.druid import DruidEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "time_grain,expected_result",
    [
        ("PT1S", "TIME_FLOOR(CAST(col AS TIMESTAMP), 'PT1S')"),
        ("PT5M", "TIME_FLOOR(CAST({col} AS TIMESTAMP), 'PT5M')"),
        (
            "P1W/1970-01-03T00:00:00Z",
            "TIME_SHIFT(TIME_FLOOR(TIME_SHIFT(CAST(col AS TIMESTAMP), 'P1D', 1), 'P1W'), 'P1D', 5)",  # noqa: E501
        ),
        (
            "1969-12-28T00:00:00Z/P1W",
            "TIME_SHIFT(TIME_FLOOR(TIME_SHIFT(CAST(col AS TIMESTAMP), 'P1D', 1), 'P1W'), 'P1D', -1)",  # noqa: E501
        ),
    ],
)
def test_timegrain_expressions(time_grain: str, expected_result: str) -> None:
    """
    DB Eng Specs (druid): Test time grain expressions
    """
    from superset.db_engine_specs.druid import DruidEngineSpec

    assert str(
        DruidEngineSpec.get_timestamp_expr(
            col=column("col"), pdf=None, time_grain=time_grain
        )
    )


def test_extras_without_ssl() -> None:
    from superset.db_engine_specs.druid import DruidEngineSpec
    from tests.integration_tests.fixtures.database import default_db_extra

    database = mock.Mock()
    database.extra = default_db_extra
    database.server_cert = None
    extras = DruidEngineSpec.get_extra_params(database)
    assert "connect_args" not in extras["engine_params"]


def test_extras_with_ssl() -> None:
    from superset.db_engine_specs.druid import DruidEngineSpec
    from tests.integration_tests.fixtures.certificates import ssl_certificate
    from tests.integration_tests.fixtures.database import default_db_extra

    database = mock.Mock()
    database.extra = default_db_extra
    database.server_cert = ssl_certificate
    extras = DruidEngineSpec.get_extra_params(database)
    connect_args = extras["engine_params"]["connect_args"]
    assert connect_args["scheme"] == "https"
    assert "ssl_verify_cert" in connect_args


# ---------------------------------------------------------------------------
# DruidEngineSpec column normalization tests
#
# pydruid infers column types from the first row value, which causes two
# related problems:
#
#   Case 1 – Mixed IEEE special-float strings and numbers:
#     Druid cannot represent NaN/Infinity in JSON, so pydruid emits them as
#     the strings "NaN", "Infinity", or "-Infinity".  When these appear in a
#     numeric column, pa.array() raises ArrowInvalid on the mixed str/float
#     list and the column falls back to string serialisation.
#
#   Case 2 – None as the first value:
#     pydruid's get_type(None) returns Type.STRING, so any nullable numeric
#     column whose first row is null gets labelled STRING in the cursor
#     description.  pa.array() succeeds (producing float64) but
#     data_type() used to return STRING because the cursor description won.
#
# DruidEngineSpec overrides normalize_column_values and resolve_column_type
# to handle both cases.  BaseEngineSpec preserves the original behaviour.
# ---------------------------------------------------------------------------


def test_druid_ieee_special_floats_preserved_as_numeric() -> None:
    """
    Case 1, DruidEngineSpec: columns that mix IEEE special-float strings with
    real numbers must keep their numeric type (specials become null).
    """
    from superset.db_engine_specs.druid import DruidEngineSpec

    data = [("NaN",), (1.5,), ("Infinity",), (2.3,), ("-Infinity",), (None,)]
    description = [("metric", "STRING", None, None, None, None, None)]
    result_set = SupersetResultSet(data, description, DruidEngineSpec)  # type: ignore

    col = result_set.columns[0]
    assert col["type"] == "FLOAT"

    df = result_set.to_pandas_df()
    assert pd.isna(df["metric"].iloc[0])  # "NaN" → null
    assert df["metric"].iloc[1] == 1.5
    assert pd.isna(df["metric"].iloc[2])  # "Infinity" → null
    assert df["metric"].iloc[3] == 2.3
    assert pd.isna(df["metric"].iloc[4])  # "-Infinity" → null
    assert pd.isna(df["metric"].iloc[5])  # None → null


def test_base_spec_ieee_special_floats_stringified() -> None:
    """
    Case 1, BaseEngineSpec: without Druid's override, columns with mixed
    special-float strings and numbers fall through to string serialisation.
    """
    data = [("NaN",), (1.5,), ("Infinity",)]
    description = [("metric", "STRING", None, None, None, None, None)]
    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    col = result_set.columns[0]
    assert col["type"] == "STRING"

    df = result_set.to_pandas_df()
    assert df["metric"].iloc[0] == "NaN"
    assert df["metric"].iloc[1] == "1.5"
    assert df["metric"].iloc[2] == "Infinity"


def test_druid_none_first_value_reports_numeric_type() -> None:
    """
    Case 2, DruidEngineSpec: when the cursor description says STRING (pydruid's
    first-row None inference) but PyArrow correctly infers float64, the column
    must be reported as FLOAT, not STRING.
    """
    from superset.db_engine_specs.druid import DruidEngineSpec

    data = [(None,), (1.5,), (2.3,), (None,), (4.7,)]
    description = [("metric", "STRING", None, None, None, None, None)]
    result_set = SupersetResultSet(data, description, DruidEngineSpec)  # type: ignore

    col = result_set.columns[0]
    assert col["type"] == "FLOAT"

    df = result_set.to_pandas_df()
    assert pd.isna(df["metric"].iloc[0])
    assert df["metric"].iloc[1] == 1.5
    assert df["metric"].iloc[4] == 4.7


def test_base_spec_none_first_value_reports_string_type() -> None:
    """
    Case 2, BaseEngineSpec: the cursor-description STRING type must continue
    to win over PyArrow's float64 inference for non-Druid engines.
    """
    data = [(None,), (1.5,), (2.3,)]
    description = [("metric", "STRING", None, None, None, None, None)]
    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    col = result_set.columns[0]
    assert col["type"] == "STRING"


def test_non_string_cursor_type_unaffected_by_druid_spec() -> None:
    """
    Columns with a non-STRING cursor description type must not be affected by
    DruidEngineSpec's resolve_column_type override.
    """
    from superset.db_engine_specs.druid import DruidEngineSpec

    data = [(1,), (2,), (3,)]
    description = [("count", "INT", None, None, None, None, None)]
    result_set = SupersetResultSet(data, description, DruidEngineSpec)  # type: ignore

    col = result_set.columns[0]
    assert col["type"] == "INT"
