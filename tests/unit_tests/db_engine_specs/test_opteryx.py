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
import sys
from datetime import datetime
from types import ModuleType
from typing import Any
from unittest import mock

import pytest
from sqlalchemy import types

from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY
from superset.db_engine_specs.exceptions import (
    SupersetDBAPIDatabaseError,
    SupersetDBAPIError,
    SupersetDBAPIOperationalError,
    SupersetDBAPIProgrammingError,
)
from superset.db_engine_specs.opteryx import OpteryxEngineSpec
from superset.errors import SupersetErrorType
from superset.utils import json
from superset.utils.core import GenericDataType, QueryStatus
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "CAST('2019-01-02' AS DATE)"),
        ("DATE", "CAST('2019-01-02' AS DATE)"),
        ("DateTime", "CAST('2019-01-02 03:04:05.678900' AS TIMESTAMP)"),
        ("TimeStamp", "CAST('2019-01-02 03:04:05.678900' AS TIMESTAMP)"),
        ("TIMESTAMP", "CAST('2019-01-02 03:04:05.678900' AS TIMESTAMP)"),
        ("VARCHAR", None),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: str | None,
    dttm: datetime,  # noqa: F811
) -> None:
    assert_convert_dttm(OpteryxEngineSpec, target_type, expected_result, dttm)


def test_epoch_to_dttm() -> None:
    assert OpteryxEngineSpec.epoch_to_dttm().format(col="ts") == "FROM_UNIXTIME(ts)"
    assert (
        OpteryxEngineSpec.epoch_ms_to_dttm().format(col="ts")
        == "FROM_UNIXTIME((ts/1000))"
    )


@pytest.mark.parametrize(
    "time_grain,expected",
    [
        (None, "ts"),
        ("PT1S", "DATE_TRUNC('second', CAST(ts AS TIMESTAMP))"),
        ("PT5S", "TIME_BUCKET(5, 'second', CAST(ts AS TIMESTAMP))"),
        ("PT30S", "TIME_BUCKET(30, 'second', CAST(ts AS TIMESTAMP))"),
        ("PT1M", "DATE_TRUNC('minute', CAST(ts AS TIMESTAMP))"),
        ("PT5M", "TIME_BUCKET(5, 'minute', CAST(ts AS TIMESTAMP))"),
        ("PT10M", "TIME_BUCKET(10, 'minute', CAST(ts AS TIMESTAMP))"),
        ("PT15M", "TIME_BUCKET(15, 'minute', CAST(ts AS TIMESTAMP))"),
        ("PT30M", "TIME_BUCKET(30, 'minute', CAST(ts AS TIMESTAMP))"),
        ("PT0.5H", "TIME_BUCKET(30, 'minute', CAST(ts AS TIMESTAMP))"),
        ("PT1H", "DATE_TRUNC('hour', CAST(ts AS TIMESTAMP))"),
        ("PT6H", "TIME_BUCKET(6, 'hour', CAST(ts AS TIMESTAMP))"),
        ("P1D", "DATE_TRUNC('day', CAST(ts AS TIMESTAMP))"),
        ("P1W", "DATE_TRUNC('week', CAST(ts AS TIMESTAMP))"),
        ("1969-12-29T00:00:00Z/P1W", "DATE_TRUNC('week', CAST(ts AS TIMESTAMP))"),
        (
            "1969-12-28T00:00:00Z/P1W",
            "DATE_TRUNC('week', CAST(ts AS TIMESTAMP) + INTERVAL '1' DAY)"
            " - INTERVAL '1' DAY",
        ),
        (
            "P1W/1970-01-03T00:00:00Z",
            "DATE_TRUNC('week', CAST(ts AS TIMESTAMP) + INTERVAL '1' DAY)"
            " + INTERVAL '5' DAY",
        ),
        (
            "P1W/1970-01-04T00:00:00Z",
            "DATE_TRUNC('week', CAST(ts AS TIMESTAMP)) + INTERVAL '6' DAY",
        ),
        ("P1M", "DATE_TRUNC('month', CAST(ts AS TIMESTAMP))"),
        ("P3M", "DATE_TRUNC('quarter', CAST(ts AS TIMESTAMP))"),
        ("P0.25Y", "DATE_TRUNC('quarter', CAST(ts AS TIMESTAMP))"),
        ("P1Y", "DATE_TRUNC('year', CAST(ts AS TIMESTAMP))"),
    ],
)
def test_time_grain_expressions(time_grain: str | None, expected: str) -> None:
    assert (
        OpteryxEngineSpec._time_grain_expressions[time_grain].format(col="ts")
        == expected
    )


@pytest.mark.parametrize(
    "native_type,sqla_type,generic_type,is_dttm",
    [
        ("INT64", types.Integer, GenericDataType.NUMERIC, False),
        ("UINT32", types.BigInteger, GenericDataType.NUMERIC, False),
        ("FLOAT64", types.Float, GenericDataType.NUMERIC, False),
        ("DECIMAL(18,2)", types.Numeric, GenericDataType.NUMERIC, False),
        ("BOOL", types.Boolean, GenericDataType.BOOLEAN, False),
        ("VARCHAR", types.String, GenericDataType.STRING, False),
        ("NVARCHAR", types.UnicodeText, GenericDataType.STRING, False),
        ("TIMESTAMP", types.TIMESTAMP, GenericDataType.TEMPORAL, True),
        ("DATE", types.Date, GenericDataType.TEMPORAL, True),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    assert_column_spec(
        OpteryxEngineSpec, native_type, sqla_type, None, generic_type, is_dttm
    )


@pytest.mark.parametrize(
    "message,error_type,expected",
    [
        (
            "Authentication error: invalid_client",
            SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
            "Opteryx rejected the client credentials: invalid_client. Check the "
            "client ID and secret.",
        ),
        (
            "Dataset `demo.geo.nope` cannot be found. Dataset names may need "
            "qualifying with their workspace and collection.",
            SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
            'The dataset "demo.geo.nope" does not exist or is not visible to this '
            "client. Datasets are named workspace.collection.dataset.",
        ),
        (
            "Column *nope* cannot be found. List a table's columns with "
            "**SHOW COLUMNS FROM** and the table name.",
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            'The column "nope" does not exist.',
        ),
    ],
)
def test_extract_errors(
    message: str,
    error_type: SupersetErrorType,
    expected: str,
) -> None:
    errors = OpteryxEngineSpec.extract_errors(Exception(message))
    assert [(error.error_type, error.message) for error in errors] == [
        (error_type, expected)
    ]


def _fake_driver(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    """
    Install a stand-in for ``opteryx-sqlalchemy``'s PEP 249 module.
    """
    dbapi = ModuleType("sqlalchemy_dialect.dbapi")
    dbapi.Error = type("Error", (Exception,), {})  # type: ignore[attr-defined]
    dbapi.InterfaceError = type("InterfaceError", (dbapi.Error,), {})  # type: ignore[attr-defined]
    dbapi.DatabaseError = type("DatabaseError", (dbapi.Error,), {})  # type: ignore[attr-defined]
    for name in (
        "DataError",
        "IntegrityError",
        "InternalError",
        "NotSupportedError",
        "OperationalError",
        "ProgrammingError",
    ):
        setattr(dbapi, name, type(name, (dbapi.DatabaseError,), {}))
    package = ModuleType("sqlalchemy_dialect")
    package.dbapi = dbapi  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "sqlalchemy_dialect", package)
    monkeypatch.setitem(sys.modules, "sqlalchemy_dialect.dbapi", dbapi)
    return dbapi


@pytest.mark.parametrize(
    "driver_error,superset_error",
    [
        ("OperationalError", SupersetDBAPIOperationalError),
        ("ProgrammingError", SupersetDBAPIProgrammingError),
        ("DatabaseError", SupersetDBAPIDatabaseError),
        ("NotSupportedError", SupersetDBAPIDatabaseError),
        ("InterfaceError", SupersetDBAPIError),
    ],
)
def test_get_dbapi_mapped_exception(
    monkeypatch: pytest.MonkeyPatch,
    driver_error: str,
    superset_error: type[Exception],
) -> None:
    dbapi = _fake_driver(monkeypatch)
    message = "Authentication error: invalid_client"

    mapped = OpteryxEngineSpec.get_dbapi_mapped_exception(
        getattr(dbapi, driver_error)(message)
    )

    assert type(mapped) is superset_error
    # The message is kept, so ``custom_errors`` still match it.
    assert str(mapped) == message


def test_get_dbapi_exception_mapping_without_driver(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setitem(sys.modules, "sqlalchemy_dialect", None)

    assert OpteryxEngineSpec.get_dbapi_exception_mapping() == {}


def test_get_function_names(monkeypatch: pytest.MonkeyPatch) -> None:
    functions = ModuleType("sqlalchemy_dialect.functions")
    functions.FUNCTION_NAMES = ("COUNT", "DATE_TRUNC", "UPPER")  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "sqlalchemy_dialect.functions", functions)

    assert OpteryxEngineSpec.get_function_names(mock.MagicMock()) == [
        "COUNT",
        "DATE_TRUNC",
        "UPPER",
    ]


def test_get_function_names_without_driver(monkeypatch: pytest.MonkeyPatch) -> None:
    # Driver releases before 0.0.13 have no function list.
    monkeypatch.setitem(sys.modules, "sqlalchemy_dialect.functions", None)

    assert OpteryxEngineSpec.get_function_names(mock.MagicMock()) == []


def test_execute_submits_without_waiting_for_sql_lab() -> None:
    cursor = mock.MagicMock()

    OpteryxEngineSpec.execute(cursor, "SELECT 1", mock.MagicMock(), async_=True)

    cursor.execute_async.assert_called_once_with("SELECT 1")
    cursor.execute.assert_not_called()


def test_execute_waits_outside_sql_lab() -> None:
    cursor = mock.MagicMock()

    OpteryxEngineSpec.execute(cursor, "SELECT 1", mock.MagicMock())

    cursor.execute.assert_called_once_with("SELECT 1")
    cursor.execute_async.assert_not_called()


def test_execute_with_a_driver_without_execute_async() -> None:
    # Driver releases before 0.0.13 can only block.
    cursor = mock.MagicMock(spec=["execute", "arraysize"])

    OpteryxEngineSpec.execute(cursor, "SELECT 1", mock.MagicMock(), async_=True)

    cursor.execute.assert_called_once_with("SELECT 1")


def test_execute_maps_driver_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    dbapi = _fake_driver(monkeypatch)
    cursor = mock.MagicMock()
    cursor.execute_async.side_effect = dbapi.OperationalError("Connection error: x")

    with pytest.raises(SupersetDBAPIOperationalError, match="Connection error: x"):
        OpteryxEngineSpec.execute(cursor, "SELECT 1", mock.MagicMock(), async_=True)


def test_get_cancel_query_id() -> None:
    cursor = mock.MagicMock(statement_handle="20261108120000-abcdefghijklmnop")

    assert (
        OpteryxEngineSpec.get_cancel_query_id(cursor, mock.MagicMock())
        == "20261108120000-abcdefghijklmnop"
    )
    assert OpteryxEngineSpec.has_query_id_before_execute is False


def test_cancel_query() -> None:
    cursor = mock.MagicMock()
    cursor.cancel.return_value = True

    assert OpteryxEngineSpec.cancel_query(
        cursor, mock.MagicMock(), "20261108120000-abcdefghijklmnop"
    )
    cursor.cancel.assert_called_once_with("20261108120000-abcdefghijklmnop")


@pytest.mark.parametrize("cancel_query_id", ["../jobs", "a/b", "", None])
def test_cancel_query_rejects_malformed_ids(cancel_query_id: str | None) -> None:
    cursor = mock.MagicMock()

    assert not OpteryxEngineSpec.cancel_query(
        cursor,
        mock.MagicMock(),
        cancel_query_id,  # type: ignore[arg-type]
    )
    cursor.cancel.assert_not_called()


def test_cancel_query_failure() -> None:
    cursor = mock.MagicMock()
    cursor.cancel.side_effect = Exception("Authentication error: forbidden")

    assert not OpteryxEngineSpec.cancel_query(
        cursor, mock.MagicMock(), "20261108120000-abcdefghijklmnop"
    )


@pytest.mark.parametrize(
    "initial_extra,final_extra",
    [
        ({}, {QUERY_EARLY_CANCEL_KEY: True}),
        ({QUERY_CANCEL_KEY: "job-1"}, {QUERY_CANCEL_KEY: "job-1"}),
    ],
)
def test_prepare_cancel_query(
    initial_extra: dict[str, Any], final_extra: dict[str, Any]
) -> None:
    from superset.models.sql_lab import Query

    query = Query(extra_json=json.dumps(initial_extra))
    OpteryxEngineSpec.prepare_cancel_query(query)
    assert query.extra == final_extra


@pytest.mark.parametrize(
    "extra,status,cancelled",
    [
        ({QUERY_EARLY_CANCEL_KEY: True}, QueryStatus.RUNNING, True),
        ({}, QueryStatus.STOPPED, True),
        ({}, QueryStatus.RUNNING, False),
    ],
)
def test_handle_cursor_cancels_a_stop_that_came_first(
    extra: dict[str, Any], status: QueryStatus, cancelled: bool
) -> None:
    from superset.models.sql_lab import Query

    query = Query(extra_json=json.dumps(extra), status=status)
    cursor = mock.MagicMock(statement_handle="20261108120000-abcdefghijklmnop")
    with mock.patch("superset.db_engine_specs.opteryx.db") as db:
        OpteryxEngineSpec.handle_cursor(cursor, query)
    db.session.refresh.assert_called_once_with(query)
    assert cursor.cancel.called is cancelled


def test_handle_cursor_without_a_job() -> None:
    cursor = mock.MagicMock(statement_handle=None)
    with mock.patch("superset.db_engine_specs.opteryx.db") as db:
        OpteryxEngineSpec.handle_cursor(cursor, mock.MagicMock())
    db.session.refresh.assert_not_called()
    cursor.cancel.assert_not_called()


def test_engine_capabilities() -> None:
    assert OpteryxEngineSpec.engine == "opteryx"
    assert OpteryxEngineSpec.allows_cte_in_subquery is False
    assert OpteryxEngineSpec.supports_file_upload is False
    assert OpteryxEngineSpec.disable_ssh_tunneling is True
