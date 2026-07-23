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
from typing import Any, Optional
from unittest.mock import MagicMock, Mock

import pandas as pd
import pytest
from sqlalchemy import types
from sqlalchemy.engine import make_url

from superset.db_engine_specs.singlestore import SingleStoreSpec
from superset.models.sql_lab import Query
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "CAST('2019-01-02' AS DATE)"),
        ("DateTime", "CAST('2019-01-02 03:04:05.678900' AS DATETIME(6))"),
        ("Timestamp", "('2019-01-02 03:04:05.678900' :> TIMESTAMP(6))"),
        ("Time", "CAST('03:04:05.678900' AS TIME(6))"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    assert_convert_dttm(SingleStoreSpec, target_type, expected_result, dttm)


def test_epoch_to_dttm() -> None:
    assert SingleStoreSpec.epoch_to_dttm() == "from_unixtime({col})"


def test_cancel_query_success() -> None:
    query = Query()
    cursor_mock = Mock()
    assert SingleStoreSpec.cancel_query(cursor_mock, query, "123 5") is True

    cursor_mock.execute.assert_called_once_with("KILL CONNECTION 123 5")


def test_cancel_query_failed() -> None:
    query = Query()
    cursor_mock = Mock()
    cursor_mock.execute.side_effect = Exception("Execution failed")

    assert SingleStoreSpec.cancel_query(cursor_mock, query, "123 6") is False

    cursor_mock.execute.assert_called_once_with("KILL CONNECTION 123 6")


def test_get_cancel_query_id() -> None:
    query = Query()
    cursor_mock = Mock()
    cursor_mock.fetchone.return_value = (123, 6)

    assert SingleStoreSpec.get_cancel_query_id(cursor_mock, query) == "123 6"
    cursor_mock.execute.assert_called_once_with(
        "SELECT CONNECTION_ID(), AGGREGATOR_ID()"
    )


def test_get_schema_from_engine_params() -> None:
    assert (
        SingleStoreSpec.get_schema_from_engine_params(
            make_url("singlestoredb://admin:admin@localhost:10000/dbName!"), {}
        )
        == "dbName!"
    )


def test_adjust_engine_params() -> None:
    from flask import current_app as app

    adjusted = SingleStoreSpec.adjust_engine_params(
        make_url("singlestoredb://user:password@host:5432/dev"),
        {},
        schema="pro d",
    )

    expected_version = app.config.get("VERSION_STRING", "dev")
    assert adjusted == (
        make_url("singlestoredb://user:password@host:5432/pro%20d"),
        {
            "conn_attrs": {
                "_connector_name": "SingleStore Superset Database Engine",
                "_connector_version": expected_version,
                "_product_version": expected_version,
            }
        },
    )


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        # Numeric
        ("TINYINT", types.SmallInteger, None, GenericDataType.NUMERIC, False),
        ("SMALLINT", types.SmallInteger, None, GenericDataType.NUMERIC, False),
        ("MEDIUMINT", types.Integer, None, GenericDataType.NUMERIC, False),
        ("INT", types.Integer, None, GenericDataType.NUMERIC, False),
        ("BIGINT", types.BigInteger, None, GenericDataType.NUMERIC, False),
        ("YEAR", types.Integer, None, GenericDataType.NUMERIC, False),
        ("FLOAT", types.Float, None, GenericDataType.NUMERIC, False),
        ("DOUBLE", types.Float, None, GenericDataType.NUMERIC, False),
        ("DECIMAL", types.Numeric, None, GenericDataType.NUMERIC, False),
        ("DECIMAL(10)", types.Numeric, None, GenericDataType.NUMERIC, False),
        ("DECIMAL(10, 10)", types.Numeric, None, GenericDataType.NUMERIC, False),
        # String
        ("CHAR", types.String, None, GenericDataType.STRING, False),
        ("VARCHAR", types.String, None, GenericDataType.STRING, False),
        ("TEXT", types.String, None, GenericDataType.STRING, False),
        ("TINYTEXT", types.String, None, GenericDataType.STRING, False),
        ("MEDIUMTEXT", types.String, None, GenericDataType.STRING, False),
        ("LONGTEXT", types.String, None, GenericDataType.STRING, False),
        ("BINARY", types.LargeBinary, None, GenericDataType.STRING, False),
        ("VARBINARY", types.LargeBinary, None, GenericDataType.STRING, False),
        ("BLOB", types.LargeBinary, None, GenericDataType.STRING, False),
        ("TINYBLOB", types.LargeBinary, None, GenericDataType.STRING, False),
        ("MEDIUMBLOB", types.LargeBinary, None, GenericDataType.STRING, False),
        ("LONGBLOB", types.LargeBinary, None, GenericDataType.STRING, False),
        ("JSON", types.String, None, GenericDataType.STRING, False),
        ("BSON", types.LargeBinary, None, GenericDataType.STRING, False),
        ("GEOGRAPHYPOINT", types.String, None, GenericDataType.STRING, False),
        ("GEOGRAPHY", types.String, None, GenericDataType.STRING, False),
        ("ENUM('a', 'b')", types.String, None, GenericDataType.STRING, False),
        ("SET('a', 'b')", types.String, None, GenericDataType.STRING, False),
        ("BIT", types.LargeBinary, None, GenericDataType.STRING, False),
        ("VECTOR(3, I32)", types.String, None, GenericDataType.STRING, False),
        # Temporal
        ("DATE", types.Date, None, GenericDataType.TEMPORAL, True),
        ("TIMESTAMP", types.TIMESTAMP, None, GenericDataType.TEMPORAL, True),
        ("TIMESTAMP(6)", types.TIMESTAMP, None, GenericDataType.TEMPORAL, True),
        ("TIME", types.Time, None, GenericDataType.TEMPORAL, True),
        ("TIME(6)", types.Time, None, GenericDataType.TEMPORAL, True),
        ("DATETIME", types.DateTime, None, GenericDataType.TEMPORAL, True),
        ("DATETIME(6)", types.DateTime, None, GenericDataType.TEMPORAL, True),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    attrs: dict[str, Any] | None,
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    assert_column_spec(
        SingleStoreSpec, native_type, sqla_type, attrs, generic_type, is_dttm
    )


def test_get_function_names_no_db() -> None:
    fake_inspector = MagicMock()
    fake_inspector.default_schema_name = None

    mock_inspector_ctx = MagicMock()
    mock_inspector_ctx.__enter__.return_value = fake_inspector
    mock_inspector_ctx.__exit__.return_value = None

    mock_database = MagicMock()
    mock_database.get_inspector.return_value = mock_inspector_ctx

    assert len(SingleStoreSpec.get_function_names(mock_database)) == 289


def test_get_function_names_with_db() -> None:
    mock_inspector = MagicMock()
    mock_inspector.default_schema_name = "db`1"

    mock_inspector_ctx = MagicMock()
    mock_inspector_ctx.__enter__.return_value = mock_inspector
    mock_inspector_ctx.__exit__.return_value = None

    mock_database = MagicMock()
    mock_database.get_inspector.return_value = mock_inspector_ctx

    data = [
        {
            "Functions_in_db`1": "is_prime",
            "Function Type": "User Defined Function",
            "Definer": "admin",
            "Data Format": "",
            "Runtime Type": "PSQL",
            "Link": "",
        }
    ]

    df = pd.DataFrame(data)
    mock_database.get_df.return_value = df

    functions = SingleStoreSpec.get_function_names(mock_database)
    assert len(functions) == 290
    assert "is_prime" in functions

    mock_database.get_df.assert_called_once_with("SHOW FUNCTIONS IN `db``1`")
