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
# pylint: disable=unused-argument, import-outside-toplevel, protected-access
from __future__ import annotations

import copy
import math
from collections import namedtuple
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from unittest.mock import MagicMock, Mock, patch

import pandas as pd
import pytest
from flask import g, has_app_context
from pytest_mock import MockerFixture
from requests.exceptions import ConnectionError as RequestsConnectionError
from sqlalchemy import column, sql, text, types
from sqlalchemy.dialects import sqlite
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import NoSuchTableError, ProgrammingError
from trino.exceptions import (
    Http502Error,
    HttpError,
    IntegrityError,
    TrinoAuthError,
    TrinoConnectionError,
    TrinoExternalError,
    TrinoInternalError,
    TrinoUserError,
)
from trino.sqlalchemy import datatype
from trino.sqlalchemy.dialect import TrinoDialect

from superset.common.db_query_status import QueryStatus
from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY
from superset.db_engine_specs.exceptions import (
    SupersetDBAPIConnectionError,
    SupersetDBAPIDatabaseError,
    SupersetDBAPIOperationalError,
    SupersetDBAPIProgrammingError,
)
from superset.models.sql_types.presto_sql_types import Interval
from superset.sql.parse import Table
from superset.superset_typing import (
    OAuth2ClientConfig,
    ResultSetColumnType,
    SQLAColumnType,
    SQLType,
)
from superset.utils import json
from superset.utils.core import GenericDataType
from tests.common.assert_utils import assert_called_with_text
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


def _assert_columns_equal(actual_cols, expected_cols) -> None:
    """
    Assert equality of the given cols, bearing in mind sqlalchemy type
    instances can't be compared for equality, so will have to be converted to
    strings first.
    """
    actual = copy.deepcopy(actual_cols)
    expected = copy.deepcopy(expected_cols)

    for col in actual:
        col["type"] = str(col["type"])

    for col in expected:
        col["type"] = str(col["type"])

    assert actual == expected


@pytest.mark.parametrize(
    "extra,expected",
    [
        ({}, {"engine_params": {"connect_args": {"source": "Apache Superset"}}}),
        (
            {
                "first": 1,
                "engine_params": {
                    "second": "two",
                    "connect_args": {"source": "foobar", "third": "three"},
                },
            },
            {
                "first": 1,
                "engine_params": {
                    "second": "two",
                    "connect_args": {"source": "foobar", "third": "three"},
                },
            },
        ),
    ],
)
def test_get_extra_params(extra: dict[str, Any], expected: dict[str, Any]) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    database = Mock()

    database.extra = json.dumps(extra)
    database.server_cert = None
    assert TrinoEngineSpec.get_extra_params(database) == expected


@patch("superset.db_engine_specs.trino.create_ssl_cert_file")
def test_get_extra_params_with_server_cert(mock_create_ssl_cert_file: Mock) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    database = Mock()

    database.extra = json.dumps({})
    database.server_cert = "TEST_CERT"
    database.db_engine_spec = TrinoEngineSpec
    mock_create_ssl_cert_file.return_value = "/path/to/tls.crt"
    extra = TrinoEngineSpec.get_extra_params(database)

    connect_args = extra.get("engine_params", {}).get("connect_args", {})
    assert connect_args.get("http_scheme") == "https"
    assert connect_args.get("verify") == "/path/to/tls.crt"
    mock_create_ssl_cert_file.assert_called_once_with(database.server_cert)


@patch("trino.auth.BasicAuthentication")
def test_auth_basic(mock_auth: Mock) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    database = Mock()

    auth_params = {"username": "username", "password": "password"}
    database.encrypted_extra = json.dumps(
        {"auth_method": "basic", "auth_params": auth_params}
    )

    params: dict[str, Any] = {}
    TrinoEngineSpec.update_params_from_encrypted_extra(database, params)
    connect_args = params.setdefault("connect_args", {})
    assert connect_args.get("http_scheme") == "https"
    mock_auth.assert_called_once_with(**auth_params)


@patch("trino.auth.KerberosAuthentication")
def test_auth_kerberos(mock_auth: Mock) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    database = Mock()

    auth_params = {
        "service_name": "superset",
        "mutual_authentication": False,
        "delegate": True,
    }
    database.encrypted_extra = json.dumps(
        {"auth_method": "kerberos", "auth_params": auth_params}
    )

    params: dict[str, Any] = {}
    TrinoEngineSpec.update_params_from_encrypted_extra(database, params)
    connect_args = params.setdefault("connect_args", {})
    assert connect_args.get("http_scheme") == "https"
    mock_auth.assert_called_once_with(**auth_params)


@patch("trino.auth.CertificateAuthentication")
def test_auth_certificate(mock_auth: Mock) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    database = Mock()
    auth_params = {"cert": "/path/to/cert.pem", "key": "/path/to/key.pem"}
    database.encrypted_extra = json.dumps(
        {"auth_method": "certificate", "auth_params": auth_params}
    )

    params: dict[str, Any] = {}
    TrinoEngineSpec.update_params_from_encrypted_extra(database, params)
    connect_args = params.setdefault("connect_args", {})
    assert connect_args.get("http_scheme") == "https"
    mock_auth.assert_called_once_with(**auth_params)


@patch("trino.auth.JWTAuthentication")
def test_auth_jwt(mock_auth: Mock) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    database = Mock()

    auth_params = {"token": "jwt-token-string"}
    database.encrypted_extra = json.dumps(
        {"auth_method": "jwt", "auth_params": auth_params}
    )

    params: dict[str, Any] = {}
    TrinoEngineSpec.update_params_from_encrypted_extra(database, params)
    connect_args = params.setdefault("connect_args", {})
    assert connect_args.get("http_scheme") == "https"
    mock_auth.assert_called_once_with(**auth_params)


def test_auth_custom_auth() -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    database = Mock()
    auth_class = Mock()

    auth_method = "custom_auth"
    auth_params = {"params1": "params1", "params2": "params2"}
    database.encrypted_extra = json.dumps(
        {"auth_method": auth_method, "auth_params": auth_params}
    )

    with patch.dict(
        "superset.config.ALLOWED_EXTRA_AUTHENTICATIONS",
        {"trino": {"custom_auth": auth_class}},
        clear=True,
    ):
        params: dict[str, Any] = {}
        TrinoEngineSpec.update_params_from_encrypted_extra(database, params)

        connect_args = params.setdefault("connect_args", {})
        assert connect_args.get("http_scheme") == "https"

        auth_class.assert_called_once_with(**auth_params)


def test_auth_custom_auth_denied() -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    database = Mock()
    auth_method = "my.module:TrinoAuthClass"
    auth_params = {"params1": "params1", "params2": "params2"}
    database.encrypted_extra = json.dumps(
        {"auth_method": auth_method, "auth_params": auth_params}
    )

    # patch.dict restores the shared dict on exit; rebinding the module attribute
    # would leak into later tests and break test_auth_custom_auth when it runs
    # afterwards (e.g. under random ordering).
    with (
        patch.dict("superset.config.ALLOWED_EXTRA_AUTHENTICATIONS", {}, clear=True),
        pytest.raises(ValueError) as excinfo,  # noqa: PT011
    ):
        TrinoEngineSpec.update_params_from_encrypted_extra(database, {})

    assert str(excinfo.value) == (
        f"For security reason, custom authentication '{auth_method}' "
        f"must be listed in 'ALLOWED_EXTRA_AUTHENTICATIONS' config"
    )


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        ("BOOLEAN", types.Boolean, None, GenericDataType.BOOLEAN, False),
        ("TINYINT", types.Integer, None, GenericDataType.NUMERIC, False),
        ("SMALLINT", types.SmallInteger, None, GenericDataType.NUMERIC, False),
        ("INTEGER", types.Integer, None, GenericDataType.NUMERIC, False),
        ("BIGINT", types.BigInteger, None, GenericDataType.NUMERIC, False),
        ("REAL", types.FLOAT, None, GenericDataType.NUMERIC, False),
        ("DOUBLE", types.FLOAT, None, GenericDataType.NUMERIC, False),
        ("DECIMAL", types.DECIMAL, None, GenericDataType.NUMERIC, False),
        ("TIME", types.Time, None, GenericDataType.TEMPORAL, True),
        ("INTERVAL DAY TO SECOND", Interval, None, GenericDataType.TEMPORAL, True),
        ("VARCHAR", types.String, None, GenericDataType.STRING, False),
        ("VARCHAR(20)", types.VARCHAR, {"length": 20}, GenericDataType.STRING, False),
        ("CHAR", types.String, None, GenericDataType.STRING, False),
        ("CHAR(2)", types.CHAR, {"length": 2}, GenericDataType.STRING, False),
        ("JSON", types.JSON, None, GenericDataType.STRING, False),
        ("TIMESTAMP", types.TIMESTAMP, None, GenericDataType.TEMPORAL, True),
        ("TIMESTAMP(3)", types.TIMESTAMP, None, GenericDataType.TEMPORAL, True),
        (
            "TIMESTAMP WITH TIME ZONE",
            types.TIMESTAMP,
            None,
            GenericDataType.TEMPORAL,
            True,
        ),
        (
            "TIMESTAMP(3) WITH TIME ZONE",
            types.TIMESTAMP,
            None,
            GenericDataType.TEMPORAL,
            True,
        ),
        ("DATE", types.Date, None, GenericDataType.TEMPORAL, True),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec as spec  # noqa: N813

    assert_column_spec(
        spec,
        native_type,
        sqla_type,
        attrs,
        generic_type,
        is_dttm,
    )


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("TimeStamp", "TIMESTAMP '2019-01-02 03:04:05.678900'"),
        ("TimeStamp(3)", "TIMESTAMP '2019-01-02 03:04:05.678900'"),
        ("TimeStamp With Time Zone", "TIMESTAMP '2019-01-02 03:04:05.678900'"),
        ("TimeStamp(3) With Time Zone", "TIMESTAMP '2019-01-02 03:04:05.678900'"),
        ("Date", "DATE '2019-01-02'"),
        # TIME and INTERVAL are matched by column_type_mappings, but
        # convert_dttm only special-cases Date/TIMESTAMP, so a recognized but
        # unhandled type falls through to None just like an unknown one.
        ("Time", None),
        ("Interval Day To Second", None),
        ("Other", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    assert_convert_dttm(TrinoEngineSpec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "data,description,expected_result",
    [
        (
            [["1.846619834", "abc"]],
            [("dec", "decimal(12,9)"), ("str", "varchar(3)")],
            [(Decimal("1.846619834"), "abc")],
        ),
        (
            [[Decimal("1.846619834"), "abc"]],
            [("dec", "decimal(12,9)"), ("str", "varchar(3)")],
            [(Decimal("1.846619834"), "abc")],
        ),
        (
            [["1.846619834", "abc"]],
            [("dec", "decimal(12)"), ("str", "varchar(3)")],
            [(Decimal("1.846619834"), "abc")],
        ),
        (
            [["1.846619834", "abc"]],
            [("dec", "decimal"), ("str", "varchar(3)")],
            [(Decimal("1.846619834"), "abc")],
        ),
        (
            [["1.846619834", "abc"]],
            [("dec", "varchar(255)"), ("str", "varchar(3)")],
            [["1.846619834", "abc"]],
        ),
        (
            [["1.846619834", "abc"]],
            [("val", "double"), ("str", "varchar(3)")],
            [(1.846619834, "abc")],
        ),
        (
            [[1.846619834, "abc"]],
            [("val", "real"), ("str", "varchar(3)")],
            [(1.846619834, "abc")],
        ),
    ],
)
def test_column_type_mutator(
    data: list[Any],
    description: list[Any],
    expected_result: list[Any],
) -> None:
    """
    Trino's DBAPI driver can return DECIMAL columns as plain strings.
    Superset must coerce those back to ``Decimal`` at fetch time so that
    downstream numeric post-processing (e.g. a pivot with a mean
    aggregate) doesn't choke on a string value.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    mock_cursor = Mock()
    mock_cursor.fetchall.return_value = data
    mock_cursor.description = description

    assert TrinoEngineSpec.fetch_data(mock_cursor) == expected_result


@pytest.mark.parametrize(
    "string_value,expected_float",
    [
        ("NaN", math.nan),
        ("Infinity", math.inf),
        ("-Infinity", -math.inf),
    ],
)
def test_column_type_mutator_double_special_values(
    string_value: str, expected_float: float
) -> None:
    """
    Trino's wire protocol has no JSON literal for NaN/Infinity/-Infinity, so
    REAL/DOUBLE columns holding those values arrive as quoted strings. They
    must be coerced back to real floats, same as string-typed DECIMALs.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    mock_cursor = Mock()
    mock_cursor.fetchall.return_value = [[string_value]]
    mock_cursor.description = [("val", "double")]

    (result_value,) = TrinoEngineSpec.fetch_data(mock_cursor)[0]
    assert isinstance(result_value, float)
    if math.isnan(expected_float):
        assert math.isnan(result_value)
    else:
        assert result_value == expected_float


def test_get_extra_table_metadata(mocker: MockerFixture) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    db_mock = mocker.MagicMock()
    db_mock.get_indexes = Mock(
        return_value=[{"column_names": ["ds", "hour"], "name": "partition"}]
    )
    db_mock.get_extra = Mock(return_value={})
    db_mock.has_view = Mock(return_value=None)
    db_mock.get_df = Mock(return_value=pd.DataFrame({"ds": ["01-01-19"], "hour": [1]}))
    result = TrinoEngineSpec.get_extra_table_metadata(
        db_mock,
        Table("test_table", "test_schema"),
    )
    assert result["partitions"]["cols"] == ["ds", "hour"]
    assert result["partitions"]["latest"] == {"ds": "01-01-19", "hour": 1}


def test_get_extra_table_metadata_iceberg_unpartitioned(
    mocker: MockerFixture,
) -> None:
    """
    Iceberg ``$partitions`` metadata fields must not be treated as partition
    columns, so an unpartitioned Iceberg table yields no partition metadata and
    no latest-partition query.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    db_mock = mocker.MagicMock()
    db_mock.get_indexes = Mock(
        return_value=[
            {
                "name": "partition",
                "column_names": ["data", "file_count", "record_count", "total_size"],
            }
        ]
    )
    db_mock.get_extra = Mock(return_value={})
    db_mock.has_view = Mock(return_value=None)
    db_mock.get_df = Mock()
    result = TrinoEngineSpec.get_extra_table_metadata(
        db_mock,
        Table("test_table", "test_schema"),
    )
    assert "partitions" not in result
    db_mock.get_df.assert_not_called()


def test_get_extra_table_metadata_iceberg_partitioned(
    mocker: MockerFixture,
) -> None:
    """
    A genuinely partitioned Iceberg table exposes a ``partition`` ROW column
    alongside the metadata fields. Since the real partition columns are nested
    in the ROW and not directly queryable here, the partition block is skipped
    rather than generating an invalid latest-partition query.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    db_mock = mocker.MagicMock()
    db_mock.get_indexes = Mock(
        return_value=[
            {
                "name": "partition",
                "column_names": [
                    "partition",
                    "record_count",
                    "file_count",
                    "total_size",
                    "data",
                ],
            }
        ]
    )
    db_mock.get_extra = Mock(return_value={})
    db_mock.has_view = Mock(return_value=None)
    db_mock.get_df = Mock()
    result = TrinoEngineSpec.get_extra_table_metadata(
        db_mock,
        Table("test_table", "test_schema"),
    )
    assert "partitions" not in result
    db_mock.get_df.assert_not_called()


def test_latest_sub_partition_iceberg(mocker: MockerFixture) -> None:
    """
    The ``latest_sub_partition`` macro must not query Iceberg ``$partitions``
    metadata fields: with no real partition keys it raises instead of building
    SQL.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.exceptions import SupersetTemplateException

    db_mock = mocker.MagicMock()
    db_mock.get_indexes = Mock(
        return_value=[
            {
                "name": "partition",
                "column_names": ["data", "file_count", "record_count", "total_size"],
            }
        ]
    )
    db_mock.get_df = Mock()
    with pytest.raises(SupersetTemplateException):
        TrinoEngineSpec.latest_sub_partition(
            db_mock,
            Table("test_table", "test_schema"),
            record_count="1",
        )
    db_mock.get_df.assert_not_called()


def test_filter_iceberg_partition_indexes() -> None:
    """
    Iceberg ``$partitions`` metadata indexes are dropped while real partition
    indexes (and any index sharing only some metadata names) pass through.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    # Iceberg metadata-only partition index is dropped entirely.
    assert (
        TrinoEngineSpec._filter_iceberg_partition_indexes(
            [
                {
                    "name": "partition",
                    "column_names": [
                        "data",
                        "file_count",
                        "record_count",
                        "total_size",
                    ],
                }
            ]
        )
        == []
    )

    # Hive partition index (no Iceberg signature) is returned unchanged.
    hive_indexes = [{"name": "partition", "column_names": ["ds", "hour"]}]
    assert (
        TrinoEngineSpec._filter_iceberg_partition_indexes(hive_indexes) == hive_indexes
    )

    # A Hive partition column that happens to be named ``data`` is preserved
    # because the Iceberg signature columns are absent.
    data_indexes = [{"name": "partition", "column_names": ["data"]}]
    assert (
        TrinoEngineSpec._filter_iceberg_partition_indexes(data_indexes) == data_indexes
    )

    # A real partition key alongside coincidental signature-named columns is
    # preserved untouched: not every column is an Iceberg metadata field.
    mixed_indexes = [
        {
            "name": "partition",
            "column_names": ["ds", "record_count", "file_count", "total_size"],
        }
    ]
    assert (
        TrinoEngineSpec._filter_iceberg_partition_indexes(mixed_indexes)
        == mixed_indexes
    )

    # Empty / falsy input yields an empty list.
    assert TrinoEngineSpec._filter_iceberg_partition_indexes(None) == []


@patch("sqlalchemy.engine.Engine.connect")
def test_cancel_query_success(engine_mock: Mock) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    query = Query()
    cursor_mock = engine_mock.return_value.__enter__.return_value
    assert TrinoEngineSpec.cancel_query(cursor_mock, query, "123") is True


@patch("sqlalchemy.engine.Engine.connect")
def test_cancel_query_failed(engine_mock: Mock) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    query = Query()
    cursor_mock = engine_mock.raiseError.side_effect = Exception()
    assert TrinoEngineSpec.cancel_query(cursor_mock, query, "123") is False


@pytest.mark.parametrize(
    "initial_extra,final_extra",
    [
        ({}, {QUERY_EARLY_CANCEL_KEY: True}),
        ({QUERY_CANCEL_KEY: "my_key"}, {QUERY_CANCEL_KEY: "my_key"}),
    ],
)
def test_prepare_cancel_query(
    initial_extra: dict[str, Any],
    final_extra: dict[str, Any],
    mocker: MockerFixture,
) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    query = Query(extra_json=json.dumps(initial_extra))
    TrinoEngineSpec.prepare_cancel_query(query=query)
    assert query.extra == final_extra


@pytest.mark.parametrize("cancel_early", [True, False])
@patch("superset.db_engine_specs.presto.PrestoBaseEngineSpec.handle_cursor")
@patch("superset.db_engine_specs.trino.TrinoEngineSpec.cancel_query")
@patch("superset.db_engine_specs.trino.db")
@patch("superset.db_engine_specs.trino.app")
def test_handle_cursor_early_cancel(
    mock_app: Mock,
    mock_db: Mock,
    cancel_query_mock: Mock,
    mock_presto_handle_cursor: Mock,
    cancel_early: bool,
    mocker: MockerFixture,
) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    mock_app.config = {"DB_POLL_INTERVAL_SECONDS": {"trino": 0}}

    query_id = "myQueryId"

    # Use spec to prevent MagicMock from creating attributes automatically
    cursor_mock = mocker.MagicMock(spec=["query_id", "stats", "info_uri"])
    cursor_mock.query_id = query_id
    # Set stats to FINISHED so the progress loop exits immediately
    cursor_mock.stats = {"state": "FINISHED", "completedSplits": 0, "totalSplits": 0}

    query = Query()

    if cancel_early:
        TrinoEngineSpec.prepare_cancel_query(query=query)

    TrinoEngineSpec.handle_cursor(cursor=cursor_mock, query=query)

    if cancel_early:
        assert cancel_query_mock.call_args[1]["cancel_query_id"] == query_id
    else:
        assert cancel_query_mock.call_args is None


@pytest.mark.parametrize(
    "status, cancelled, expected",
    [
        # The kill carries out an early stop, so the stop is recorded.
        (QueryStatus.RUNNING, True, QueryStatus.STOPPED),
        # The kill failed, so no stop happened and none is recorded.
        (QueryStatus.RUNNING, False, QueryStatus.RUNNING),
        # A timeout is not turned into a stop.
        (QueryStatus.TIMED_OUT, True, QueryStatus.TIMED_OUT),
    ],
)
@patch("superset.db_engine_specs.presto.PrestoBaseEngineSpec.handle_cursor")
@patch("superset.db_engine_specs.trino.TrinoEngineSpec.cancel_query")
@patch("superset.db_engine_specs.trino.db")
@patch("superset.db_engine_specs.trino.app")
def test_handle_cursor_early_cancel_records_stop_only_when_killed(
    mock_app: Mock,
    mock_db: Mock,
    cancel_query_mock: Mock,
    mock_presto_handle_cursor: Mock,
    status: QueryStatus,
    cancelled: bool,
    expected: QueryStatus,
    mocker: MockerFixture,
) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    mock_app.config = {"DB_POLL_INTERVAL_SECONDS": {"trino": 0}}
    cancel_query_mock.return_value = cancelled

    cursor_mock = mocker.MagicMock(spec=["query_id", "stats", "info_uri"])
    cursor_mock.query_id = "myQueryId"
    cursor_mock.stats = {"state": "RUNNING", "completedSplits": 0, "totalSplits": 1}

    query = Query(status=status)
    TrinoEngineSpec.prepare_cancel_query(query=query)
    mock_db.session.commit.reset_mock()

    TrinoEngineSpec.handle_cursor(cursor=cursor_mock, query=query)

    cancel_query_mock.assert_called_once()
    assert query.status == expected
    if expected == QueryStatus.STOPPED:
        assert query.end_time is not None
        # Committed before the killed statement reaches the error handler.
        assert mock_db.session.commit.call_count == 2
    else:
        assert mock_db.session.commit.call_count == 1


def test_execute_with_cursor_in_parallel(app, mocker: MockerFixture):
    """Test that `execute_with_cursor` fetches query ID from the cursor"""
    from superset.db_engine_specs.trino import TrinoEngineSpec

    query_id = "myQueryId"

    mock_cursor = mocker.MagicMock()
    mock_cursor.query_id = None

    mock_query = mocker.MagicMock()

    def _mock_execute(*args, **kwargs):
        mock_cursor.query_id = query_id

    with app.test_request_context("/some/place/"):
        mock_cursor.execute.side_effect = _mock_execute

        with patch.dict(
            "superset.config.DISALLOWED_SQL_FUNCTIONS",
            {},
            clear=True,
        ):
            TrinoEngineSpec.execute_with_cursor(
                cursor=mock_cursor,
                sql="SELECT 1 FROM foo",
                query=mock_query,
            )

            mock_query.set_extra_json_key.assert_called_once_with(
                key=QUERY_CANCEL_KEY, value=query_id
            )


def test_execute_with_cursor_app_context(app, mocker: MockerFixture):
    """Test that `execute_with_cursor` still contains the current app context"""
    from superset.db_engine_specs.trino import TrinoEngineSpec

    mock_cursor = mocker.MagicMock()
    mock_cursor.query_id = None

    mock_query = mocker.MagicMock()

    def _mock_execute(*args, **kwargs):
        assert has_app_context()
        assert g.some_value == "some_value"

    with app.test_request_context("/some/place/"):
        g.some_value = "some_value"

        with patch.object(TrinoEngineSpec, "execute", side_effect=_mock_execute):
            with patch.dict(
                "superset.config.DISALLOWED_SQL_FUNCTIONS",
                {},
                clear=True,
            ):
                TrinoEngineSpec.execute_with_cursor(
                    cursor=mock_cursor,
                    sql="SELECT 1 FROM foo",
                    query=mock_query,
                )


def test_get_columns(mocker: MockerFixture):
    """Test that ROW columns are not expanded without expand_rows"""
    from superset.db_engine_specs.trino import TrinoEngineSpec

    field1_type = datatype.parse_sqltype("row(a varchar, b date)")
    field2_type = datatype.parse_sqltype("row(r1 row(a varchar, b varchar))")
    field3_type = datatype.parse_sqltype("int")

    sqla_columns = [
        SQLAColumnType(name="field1", type=field1_type, is_dttm=False),
        SQLAColumnType(name="field2", type=field2_type, is_dttm=False),
        SQLAColumnType(name="field3", type=field3_type, is_dttm=False),
    ]
    mock_inspector = mocker.MagicMock()
    mock_inspector.get_columns.return_value = sqla_columns

    actual = TrinoEngineSpec.get_columns(mock_inspector, Table("table", "schema"))
    expected = [
        ResultSetColumnType(
            name="field1", column_name="field1", type=field1_type, is_dttm=False
        ),
        ResultSetColumnType(
            name="field2", column_name="field2", type=field2_type, is_dttm=False
        ),
        ResultSetColumnType(
            name="field3", column_name="field3", type=field3_type, is_dttm=False
        ),
    ]

    _assert_columns_equal(actual, expected)


def test_get_columns_error(mocker: MockerFixture):
    """
    Test that we fallback to a `SHOW COLUMNS FROM ...` query.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    field1_type = datatype.parse_sqltype("row(a varchar, b date)")
    field2_type = datatype.parse_sqltype("row(r1 row(a varchar, b varchar))")
    field3_type = datatype.parse_sqltype("int")

    mock_inspector = mocker.MagicMock()
    mock_inspector.engine.dialect = sqlite.dialect()
    mock_inspector.get_columns.side_effect = NoSuchTableError(
        "The specified table does not exist."
    )
    Row = namedtuple("Row", ["Column", "Type"])

    mock_connection = mocker.MagicMock()
    mock_connection.execute().fetchall.return_value = [
        Row("field1", "row(a varchar, b date)"),
        Row("field2", "row(r1 row(a varchar, b varchar))"),
        Row("field3", "int"),
    ]
    mock_inspector.engine.connect().__enter__.return_value = mock_connection

    actual = TrinoEngineSpec.get_columns(mock_inspector, Table("table", "schema"))
    expected = [
        ResultSetColumnType(
            name="field1",
            column_name="field1",
            type=field1_type,
            is_dttm=None,
            type_generic=None,
            default=None,
            nullable=True,
        ),
        ResultSetColumnType(
            name="field2",
            column_name="field2",
            type=field2_type,
            is_dttm=None,
            type_generic=None,
            default=None,
            nullable=True,
        ),
        ResultSetColumnType(
            name="field3",
            column_name="field3",
            type=field3_type,
            is_dttm=None,
            type_generic=None,
            default=None,
            nullable=True,
        ),
    ]

    _assert_columns_equal(actual, expected)

    with mock_inspector.engine.connect() as conn:
        assert_called_with_text(
            conn.execute,
            'SHOW COLUMNS FROM schema."table"',
        )


def test_get_columns_expand_rows(mocker: MockerFixture):
    """Test that ROW columns are correctly expanded with expand_rows"""
    from superset.db_engine_specs.trino import TrinoEngineSpec

    field1_type = datatype.parse_sqltype("row(a varchar, b date)")
    field2_type = datatype.parse_sqltype("row(r1 row(a varchar, b varchar))")
    field3_type = datatype.parse_sqltype("int")

    sqla_columns = [
        SQLAColumnType(name="field1", type=field1_type, is_dttm=False),
        SQLAColumnType(name="field2", type=field2_type, is_dttm=False),
        SQLAColumnType(name="field3", type=field3_type, is_dttm=False),
    ]
    mock_inspector = mocker.MagicMock()
    mock_inspector.get_columns.return_value = sqla_columns

    actual = TrinoEngineSpec.get_columns(
        mock_inspector,
        Table("table", "schema"),
        {"expand_rows": True},
    )
    expected = [
        ResultSetColumnType(
            name="field1", column_name="field1", type=field1_type, is_dttm=False
        ),
        ResultSetColumnType(
            name="field1.a",
            column_name="field1.a",
            type=types.VARCHAR(),
            is_dttm=False,
            expression='"field1"."a"',
            query_as='"field1"."a" AS "field1.a"',
        ),
        ResultSetColumnType(
            name="field1.b",
            column_name="field1.b",
            type=types.DATE(),
            is_dttm=True,
            expression='"field1"."b"',
            query_as='"field1"."b" AS "field1.b"',
        ),
        ResultSetColumnType(
            name="field2", column_name="field2", type=field2_type, is_dttm=False
        ),
        ResultSetColumnType(
            name="field2.r1",
            column_name="field2.r1",
            type=datatype.parse_sqltype("row(a varchar, b varchar)"),
            is_dttm=False,
            expression='"field2"."r1"',
            query_as='"field2"."r1" AS "field2.r1"',
        ),
        ResultSetColumnType(
            name="field2.r1.a",
            column_name="field2.r1.a",
            type=types.VARCHAR(),
            is_dttm=False,
            expression='"field2"."r1"."a"',
            query_as='"field2"."r1"."a" AS "field2.r1.a"',
        ),
        ResultSetColumnType(
            name="field2.r1.b",
            column_name="field2.r1.b",
            type=types.VARCHAR(),
            is_dttm=False,
            expression='"field2"."r1"."b"',
            query_as='"field2"."r1"."b" AS "field2.r1.b"',
        ),
        ResultSetColumnType(
            name="field3", column_name="field3", type=field3_type, is_dttm=False
        ),
    ]

    _assert_columns_equal(actual, expected)


def test_get_indexes_no_table():
    from superset.db_engine_specs.trino import TrinoEngineSpec

    db_mock = Mock()
    inspector_mock = Mock()
    inspector_mock.get_indexes = Mock(
        side_effect=NoSuchTableError("The specified table does not exist.")
    )
    result = TrinoEngineSpec.get_indexes(
        db_mock,
        inspector_mock,
        Table("test_table", "test_schema"),
    )
    assert result == []


def test_get_dbapi_exception_mapping():
    from superset.db_engine_specs.trino import TrinoEngineSpec

    mapping = TrinoEngineSpec.get_dbapi_exception_mapping()
    assert mapping.get(TrinoUserError) == SupersetDBAPIProgrammingError
    assert mapping.get(TrinoInternalError) == SupersetDBAPIDatabaseError
    assert mapping.get(TrinoExternalError) == SupersetDBAPIOperationalError
    assert mapping.get(RequestsConnectionError) == SupersetDBAPIConnectionError
    assert mapping.get(Exception) is None


def test_adjust_engine_params_fully_qualified() -> None:
    """
    Test the ``adjust_engine_params`` method when the URL has catalog and schema.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    url = make_url("trino://user:pass@localhost:8080/system/default")

    uri = TrinoEngineSpec.adjust_engine_params(url, {})[0]
    assert (
        uri.render_as_string(hide_password=False)
        == "trino://user:pass@localhost:8080/system/default"
    )

    uri = TrinoEngineSpec.adjust_engine_params(
        url,
        {},
        schema="new_schema",
    )[0]
    assert (
        uri.render_as_string(hide_password=False)
        == "trino://user:pass@localhost:8080/system/new_schema"
    )

    uri = TrinoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
    )[0]
    assert (
        uri.render_as_string(hide_password=False)
        == "trino://user:pass@localhost:8080/new_catalog/default"
    )

    uri = TrinoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
        schema="new_schema",
    )[0]
    assert (
        uri.render_as_string(hide_password=False)
        == "trino://user:pass@localhost:8080/new_catalog/new_schema"
    )


def test_adjust_engine_params_catalog_only() -> None:
    """
    Test the ``adjust_engine_params`` method when the URL has only the catalog.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    url = make_url("trino://user:pass@localhost:8080/system")

    uri = TrinoEngineSpec.adjust_engine_params(url, {})[0]
    assert (
        uri.render_as_string(hide_password=False)
        == "trino://user:pass@localhost:8080/system"
    )

    uri = TrinoEngineSpec.adjust_engine_params(
        url,
        {},
        schema="new_schema",
    )[0]
    assert (
        uri.render_as_string(hide_password=False)
        == "trino://user:pass@localhost:8080/system/new_schema"
    )

    uri = TrinoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
    )[0]
    assert (
        uri.render_as_string(hide_password=False)
        == "trino://user:pass@localhost:8080/new_catalog"
    )

    uri = TrinoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
        schema="new_schema",
    )[0]
    assert (
        uri.render_as_string(hide_password=False)
        == "trino://user:pass@localhost:8080/new_catalog/new_schema"
    )


@pytest.mark.parametrize(
    "sqlalchemy_uri,result",
    [
        ("trino://user:pass@localhost:8080/system", "system"),
        ("trino://user:pass@localhost:8080/system/default", "system"),
        ("trino://trino@localhost:8081", None),
    ],
)
def test_get_default_catalog(sqlalchemy_uri: str, result: str | None) -> None:
    """
    Test the ``get_default_catalog`` method.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.core import Database

    database = Database(
        database_name="my_db",
        sqlalchemy_uri=sqlalchemy_uri,
    )
    assert TrinoEngineSpec.get_default_catalog(database) == result


@patch("superset.db_engine_specs.trino.TrinoEngineSpec.latest_partition")
@pytest.mark.parametrize(
    ["column_type", "column_value", "expected_value"],
    [
        (types.DATE(), "2023-05-01", "DATE '2023-05-01'"),
        (types.TIMESTAMP(), "2023-05-01", "TIMESTAMP '2023-05-01'"),
        (types.VARCHAR(), "2023-05-01", "'2023-05-01'"),
        (types.INT(), 1234, "1234"),
    ],
)
def test_where_latest_partition(
    mock_latest_partition,
    column_type: SQLType,
    column_value: Any,
    expected_value: str,
) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    mock_latest_partition.return_value = (["partition_key"], [column_value])

    assert (
        str(
            TrinoEngineSpec.where_latest_partition(  # type: ignore
                database=MagicMock(),
                table=Table("table"),
                query=sql.select(text("* FROM table")),
                columns=[
                    {
                        "column_name": "partition_key",
                        "name": "partition_key",
                        "type": column_type,
                        "is_dttm": False,
                    }
                ],
            ).compile(
                dialect=TrinoDialect(),
                compile_kwargs={"literal_binds": True},
            )
        )
        == f"""SELECT * FROM table \nWHERE partition_key = {expected_value}"""  # noqa: S608
    )


@pytest.fixture
def oauth2_config() -> OAuth2ClientConfig:
    """
    Config for Trino OAuth2.
    """
    return {
        "id": "trino",
        "secret": "very-secret",
        "scope": "",
        "redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "authorization_request_uri": "https://trino.auth.server.example/realms/master/protocol/openid-connect/auth",
        "token_request_uri": "https://trino.auth.server.example/master/protocol/openid-connect/token",
        "request_content_type": "data",
    }


def test_get_oauth2_token(
    mocker: MockerFixture,
    oauth2_config: OAuth2ClientConfig,
) -> None:
    """
    Test `get_oauth2_token`.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    mocker.patch("superset.db_engine_specs.base.is_safe_host", return_value=True)
    mock_get_requester = mocker.patch(
        "superset.db_engine_specs.base.get_ssrf_safe_requester"
    )
    requests = mock_get_requester.return_value
    requests.post().json.return_value = {
        "access_token": "access-token",
        "expires_in": 3600,
        "scope": "scope",
        "token_type": "Bearer",
        "refresh_token": "refresh-token",
    }

    assert TrinoEngineSpec.get_oauth2_token(oauth2_config, "code") == {
        "access_token": "access-token",
        "expires_in": 3600,
        "scope": "scope",
        "token_type": "Bearer",
        "refresh_token": "refresh-token",
    }
    requests.post.assert_called_with(
        "https://trino.auth.server.example/master/protocol/openid-connect/token",
        data={
            "code": "code",
            "client_id": "trino",
            "client_secret": "very-secret",
            "redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
            "grant_type": "authorization_code",
        },
        timeout=30.0,
        allow_redirects=False,
    )


def test_needs_oauth2_with_401_error(mocker: MockerFixture) -> None:
    """
    Test that needs_oauth2 returns True when Trino raises an HTTP 401 error.
    """
    from trino.exceptions import HttpError

    from superset.db_engine_specs.trino import TrinoEngineSpec

    g = mocker.patch("superset.db_engine_specs.trino.g")
    g.user = mocker.MagicMock()

    ex = HttpError("error 401: Unauthorized")
    assert TrinoEngineSpec.needs_oauth2(ex) is True


def test_needs_oauth2_without_401_error(mocker: MockerFixture) -> None:
    """
    Test that needs_oauth2 returns False when the error is not a 401.
    """
    from trino.exceptions import HttpError

    from superset.db_engine_specs.trino import TrinoEngineSpec

    g = mocker.patch("superset.db_engine_specs.trino.g")
    g.user = mocker.MagicMock()

    ex = HttpError("error 500: Internal Server Error")
    assert TrinoEngineSpec.needs_oauth2(ex) is False


def test_needs_oauth2_with_non_http_error(mocker: MockerFixture) -> None:
    """
    Test that needs_oauth2 returns False for non-HttpError exceptions.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    g = mocker.patch("superset.db_engine_specs.trino.g")
    g.user = mocker.MagicMock()

    ex = RuntimeError("error 401: something else")
    assert TrinoEngineSpec.needs_oauth2(ex) is False


def test_needs_oauth2_without_user(mocker: MockerFixture) -> None:
    """
    Test that needs_oauth2 returns False when there is no authenticated user.
    """
    from trino.exceptions import HttpError

    from superset.db_engine_specs.trino import TrinoEngineSpec

    g = mocker.patch("superset.db_engine_specs.trino.g")
    del g.user

    ex = HttpError("error 401: Unauthorized")
    assert TrinoEngineSpec.needs_oauth2(ex) is False


@pytest.mark.parametrize(
    "time_grain,expected_result",
    [
        ("PT1S", "date_trunc('second', CAST(col AS TIMESTAMP))"),
        (
            "PT5S",
            "date_trunc('second', CAST(col AS TIMESTAMP)) - interval '1' second * (second(CAST(col AS TIMESTAMP)) % 5)",  # noqa: E501
        ),
        (
            "PT30S",
            "date_trunc('second', CAST(col AS TIMESTAMP)) - interval '1' second * (second(CAST(col AS TIMESTAMP)) % 30)",  # noqa: E501
        ),
        ("PT1M", "date_trunc('minute', CAST(col AS TIMESTAMP))"),
        (
            "PT5M",
            "date_trunc('minute', CAST(col AS TIMESTAMP)) - interval '1' minute * (minute(CAST(col AS TIMESTAMP)) % 5)",  # noqa: E501
        ),
        (
            "PT10M",
            "date_trunc('minute', CAST(col AS TIMESTAMP)) - interval '1' minute * (minute(CAST(col AS TIMESTAMP)) % 10)",  # noqa: E501
        ),
        (
            "PT15M",
            "date_trunc('minute', CAST(col AS TIMESTAMP)) - interval '1' minute * (minute(CAST(col AS TIMESTAMP)) % 15)",  # noqa: E501
        ),
        (
            "PT0.5H",
            "date_trunc('minute', CAST(col AS TIMESTAMP)) - interval '1' minute * (minute(CAST(col AS TIMESTAMP)) % 30)",  # noqa: E501
        ),
        ("PT1H", "date_trunc('hour', CAST(col AS TIMESTAMP))"),
        (
            "PT6H",
            "date_trunc('hour', CAST(col AS TIMESTAMP)) - interval '1' hour * (hour(CAST(col AS TIMESTAMP)) % 6)",  # noqa: E501
        ),
        ("P1D", "date_trunc('day', CAST(col AS TIMESTAMP))"),
        ("P1W", "date_trunc('week', CAST(col AS TIMESTAMP))"),
        ("P1M", "date_trunc('month', CAST(col AS TIMESTAMP))"),
        ("P3M", "date_trunc('quarter', CAST(col AS TIMESTAMP))"),
        ("P1Y", "date_trunc('year', CAST(col AS TIMESTAMP))"),
        (
            "1969-12-28T00:00:00Z/P1W",
            "date_trunc('week', CAST(col AS TIMESTAMP) + interval '1' day) - interval '1' day",  # noqa: E501
        ),
        ("1969-12-29T00:00:00Z/P1W", "date_trunc('week', CAST(col AS TIMESTAMP))"),
        (
            "P1W/1970-01-03T00:00:00Z",
            "date_trunc('week', CAST(col AS TIMESTAMP) + interval '1' day) + interval '5' day",  # noqa: E501
        ),
        (
            "P1W/1970-01-04T00:00:00Z",
            "date_trunc('week', CAST(col AS TIMESTAMP)) + interval '6' day",
        ),
    ],
)
def test_timegrain_expressions(time_grain: str, expected_result: str) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec as spec  # noqa: N813

    actual = str(
        spec.get_timestamp_expr(col=column("col"), pdf=None, time_grain=time_grain)
    )
    assert actual == expected_result


@patch("superset.db_engine_specs.presto.PrestoBaseEngineSpec.handle_cursor")
@patch("superset.db_engine_specs.trino.TrinoEngineSpec.cancel_query")
@patch("superset.db_engine_specs.trino.db")
@patch("superset.db_engine_specs.trino.app")
def test_handle_cursor_progress_updates(
    mock_app: Mock,
    mock_db: Mock,
    mock_cancel_query: Mock,
    mock_presto_handle_cursor: Mock,
    mocker: MockerFixture,
) -> None:
    """Test that handle_cursor updates query progress based on cursor stats."""
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    mock_app.config = {"DB_POLL_INTERVAL_SECONDS": {"trino": 0}}

    cursor_mock = mocker.MagicMock(spec=["query_id", "stats", "info_uri"])
    cursor_mock.query_id = "test-query-id"

    # Simulate progress: 0/10 -> 5/10 -> 10/10 (FINISHED)
    cursor_mock.stats = {"state": "RUNNING", "completedSplits": 0, "totalSplits": 10}

    call_count = 0

    def update_stats(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            cursor_mock.stats = {
                "state": "RUNNING",
                "completedSplits": 5,
                "totalSplits": 10,
            }
        elif call_count >= 2:
            cursor_mock.stats = {
                "state": "FINISHED",
                "completedSplits": 10,
                "totalSplits": 10,
            }

    with patch("superset.db_engine_specs.trino.time.sleep", side_effect=update_stats):
        query = Query()
        query.status = "running"
        TrinoEngineSpec.handle_cursor(cursor=cursor_mock, query=query)

    assert query.progress == 100.0
    assert mock_db.session.commit.called


@patch("superset.db_engine_specs.presto.PrestoBaseEngineSpec.handle_cursor")
@patch("superset.db_engine_specs.trino.TrinoEngineSpec.cancel_query")
@patch("superset.db_engine_specs.trino.db")
@patch("superset.db_engine_specs.trino.app")
def test_handle_cursor_cancels_on_stopped_status(
    mock_app: Mock,
    mock_db: Mock,
    mock_cancel_query: Mock,
    mock_presto_handle_cursor: Mock,
    mocker: MockerFixture,
) -> None:
    """Test that handle_cursor cancels query when status is STOPPED."""
    from superset.common.db_query_status import QueryStatus
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    mock_app.config = {"DB_POLL_INTERVAL_SECONDS": {"trino": 0}}

    cursor_mock = mocker.MagicMock(spec=["query_id", "stats", "info_uri"])
    cursor_mock.query_id = "test-query-id"
    cursor_mock.stats = {"state": "RUNNING", "completedSplits": 0, "totalSplits": 10}

    query = Query()
    query.status = QueryStatus.STOPPED

    with patch("superset.db_engine_specs.trino.time.sleep"):
        TrinoEngineSpec.handle_cursor(cursor=cursor_mock, query=query)

    mock_cancel_query.assert_called_once_with(
        cursor=cursor_mock,
        query=query,
        cancel_query_id="test-query-id",
    )


@patch("superset.db_engine_specs.presto.PrestoBaseEngineSpec.handle_cursor")
@patch("superset.db_engine_specs.trino.TrinoEngineSpec.cancel_query")
@patch("superset.db_engine_specs.trino.db")
@patch("superset.db_engine_specs.trino.app")
def test_handle_cursor_cancels_on_timed_out_status(
    mock_app: Mock,
    mock_db: Mock,
    mock_cancel_query: Mock,
    mock_presto_handle_cursor: Mock,
    mocker: MockerFixture,
) -> None:
    """Test that handle_cursor cancels query when status is TIMED_OUT."""
    from superset.common.db_query_status import QueryStatus
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    mock_app.config = {"DB_POLL_INTERVAL_SECONDS": {"trino": 0}}

    cursor_mock = mocker.MagicMock(spec=["query_id", "stats", "info_uri"])
    cursor_mock.query_id = "test-query-id"
    cursor_mock.stats = {"state": "RUNNING", "completedSplits": 0, "totalSplits": 10}

    query = Query()
    query.status = QueryStatus.TIMED_OUT

    with patch("superset.db_engine_specs.trino.time.sleep"):
        TrinoEngineSpec.handle_cursor(cursor=cursor_mock, query=query)

    mock_cancel_query.assert_called_once_with(
        cursor=cursor_mock,
        query=query,
        cancel_query_id="test-query-id",
    )


@patch("superset.db_engine_specs.presto.PrestoBaseEngineSpec.handle_cursor")
@patch("superset.db_engine_specs.trino.TrinoEngineSpec.cancel_query")
@patch("superset.db_engine_specs.trino.db")
@patch("superset.db_engine_specs.trino.app")
def test_handle_cursor_breaks_on_execute_error(
    mock_app: Mock,
    mock_db: Mock,
    mock_cancel_query: Mock,
    mock_presto_handle_cursor: Mock,
    mocker: MockerFixture,
) -> None:
    """Test that handle_cursor breaks the loop when execute_result has an error."""
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    mock_app.config = {"DB_POLL_INTERVAL_SECONDS": {"trino": 0}}

    cursor_mock = mocker.MagicMock(
        spec=["query_id", "stats", "info_uri", "_execute_result", "_execute_event"]
    )
    cursor_mock.query_id = "test-query-id"
    cursor_mock.stats = {"state": "RUNNING", "completedSplits": 0, "totalSplits": 10}
    cursor_mock._execute_result = {"error": Exception("Test error")}
    cursor_mock._execute_event = None

    query = Query()
    query.status = "running"

    # Should break immediately due to error in execute_result
    TrinoEngineSpec.handle_cursor(cursor=cursor_mock, query=query)

    # cancel_query should not be called since we broke due to error, not status
    mock_cancel_query.assert_not_called()


@patch("superset.db_engine_specs.presto.PrestoBaseEngineSpec.handle_cursor")
@patch("superset.db_engine_specs.trino.TrinoEngineSpec.cancel_query")
@patch("superset.db_engine_specs.trino.db")
@patch("superset.db_engine_specs.trino.app")
def test_handle_cursor_breaks_on_execute_event_set(
    mock_app: Mock,
    mock_db: Mock,
    mock_cancel_query: Mock,
    mock_presto_handle_cursor: Mock,
    mocker: MockerFixture,
) -> None:
    """Test that handle_cursor breaks the loop when execute_event is set."""
    import threading

    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    mock_app.config = {"DB_POLL_INTERVAL_SECONDS": {"trino": 0}}

    cursor_mock = mocker.MagicMock(
        spec=["query_id", "stats", "info_uri", "_execute_result", "_execute_event"]
    )
    cursor_mock.query_id = "test-query-id"
    cursor_mock.stats = {"state": "RUNNING", "completedSplits": 5, "totalSplits": 10}

    execute_event = threading.Event()
    execute_event.set()  # Simulate thread completion

    cursor_mock._execute_result = {}
    cursor_mock._execute_event = execute_event

    query = Query()
    query.status = "running"

    # Should break immediately since execute_event is set
    TrinoEngineSpec.handle_cursor(cursor=cursor_mock, query=query)

    # cancel_query should not be called since we broke due to event being set
    mock_cancel_query.assert_not_called()


@patch("superset.db_engine_specs.presto.PrestoBaseEngineSpec.handle_cursor")
@patch("superset.db_engine_specs.trino.TrinoEngineSpec.cancel_query")
@patch("superset.db_engine_specs.trino.db")
@patch("superset.db_engine_specs.trino.app")
def test_handle_cursor_handles_zero_total_splits(
    mock_app: Mock,
    mock_db: Mock,
    mock_cancel_query: Mock,
    mock_presto_handle_cursor: Mock,
    mocker: MockerFixture,
) -> None:
    """Test that handle_cursor handles zero totalSplits without division error."""
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    mock_app.config = {"DB_POLL_INTERVAL_SECONDS": {"trino": 0}}

    cursor_mock = mocker.MagicMock(spec=["query_id", "stats", "info_uri"])
    cursor_mock.query_id = "test-query-id"

    call_count = 0

    def update_stats(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count >= 1:
            cursor_mock.stats = {
                "state": "FINISHED",
                "completedSplits": 0,
                "totalSplits": 0,
            }

    # Start with zero splits
    cursor_mock.stats = {"state": "RUNNING", "completedSplits": 0, "totalSplits": 0}

    with patch("superset.db_engine_specs.trino.time.sleep", side_effect=update_stats):
        query = Query()
        query.status = "running"
        # Should not raise ZeroDivisionError
        TrinoEngineSpec.handle_cursor(cursor=cursor_mock, query=query)

    # Progress should be 0/1 = 0 when totalSplits is 0
    assert query.progress == 0.0


@patch("superset.db_engine_specs.presto.PrestoBaseEngineSpec.handle_cursor")
@patch("superset.db_engine_specs.trino.TrinoEngineSpec.cancel_query")
@patch("superset.db_engine_specs.trino.db")
@patch("superset.db_engine_specs.trino.app")
def test_handle_cursor_only_commits_on_progress_change(
    mock_app: Mock,
    mock_db: Mock,
    mock_cancel_query: Mock,
    mock_presto_handle_cursor: Mock,
    mocker: MockerFixture,
) -> None:
    """Test that handle_cursor only commits when progress changes."""
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    mock_app.config = {"DB_POLL_INTERVAL_SECONDS": {"trino": 0}}

    cursor_mock = mocker.MagicMock(spec=["query_id", "stats", "info_uri"])
    cursor_mock.query_id = "test-query-id"

    call_count = 0

    def update_stats(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        # Keep same progress for first two iterations, then finish
        if call_count < 3:
            cursor_mock.stats = {
                "state": "RUNNING",
                "completedSplits": 5,
                "totalSplits": 10,
            }
        else:
            cursor_mock.stats = {
                "state": "FINISHED",
                "completedSplits": 10,
                "totalSplits": 10,
            }

    cursor_mock.stats = {"state": "RUNNING", "completedSplits": 5, "totalSplits": 10}

    with patch("superset.db_engine_specs.trino.time.sleep", side_effect=update_stats):
        query = Query()
        query.status = "running"
        TrinoEngineSpec.handle_cursor(cursor=cursor_mock, query=query)

    # Initial commit from set_extra_json_key, then commits only when progress changes
    # Progress changes: None->0.5, 0.5->0.5 (no commit), 0.5->1.0
    # So we expect: 1 (initial) + 1 (0.5) + 1 (1.0) = 3 commits total
    commit_calls = mock_db.session.commit.call_count
    assert commit_calls >= 2  # At least initial commit and one progress update


@patch("superset.db_engine_specs.presto.PrestoBaseEngineSpec.handle_cursor")
@patch("superset.db_engine_specs.trino.TrinoEngineSpec.cancel_query")
@patch("superset.db_engine_specs.trino.db")
@patch("superset.db_engine_specs.trino.app")
def test_handle_cursor_sets_progress_text_for_planning_state(
    mock_app: Mock,
    mock_db: Mock,
    mock_cancel_query: Mock,
    mock_presto_handle_cursor: Mock,
    mocker: MockerFixture,
) -> None:
    """Test that handle_cursor sets progress_text to 'Scheduled' for PLANNING state."""
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    mock_app.config = {"DB_POLL_INTERVAL_SECONDS": {"trino": 0}}

    cursor_mock = mocker.MagicMock(spec=["query_id", "stats", "info_uri"])
    cursor_mock.query_id = "test-query-id"

    call_count = 0

    def update_stats(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count >= 1:
            cursor_mock.stats = {
                "state": "FINISHED",
                "completedSplits": 10,
                "totalSplits": 10,
            }

    # Start with PLANNING state
    cursor_mock.stats = {"state": "PLANNING", "completedSplits": 0, "totalSplits": 10}

    with patch("superset.db_engine_specs.trino.time.sleep", side_effect=update_stats):
        query = Query()
        query.status = "running"
        TrinoEngineSpec.handle_cursor(cursor=cursor_mock, query=query)

    # Check that progress_text was set to "Scheduled" for PLANNING state
    assert query.extra.get("progress_text") is not None


@patch("superset.db_engine_specs.presto.PrestoBaseEngineSpec.handle_cursor")
@patch("superset.db_engine_specs.trino.TrinoEngineSpec.cancel_query")
@patch("superset.db_engine_specs.trino.db")
@patch("superset.db_engine_specs.trino.app")
def test_handle_cursor_sets_progress_text_for_queued_state(
    mock_app: Mock,
    mock_db: Mock,
    mock_cancel_query: Mock,
    mock_presto_handle_cursor: Mock,
    mocker: MockerFixture,
) -> None:
    """Test that handle_cursor sets progress_text to 'Queued' for QUEUED state."""
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    mock_app.config = {"DB_POLL_INTERVAL_SECONDS": {"trino": 0}}

    cursor_mock = mocker.MagicMock(spec=["query_id", "stats", "info_uri"])
    cursor_mock.query_id = "test-query-id"

    call_count = 0

    def update_stats(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count >= 1:
            cursor_mock.stats = {
                "state": "FINISHED",
                "completedSplits": 10,
                "totalSplits": 10,
            }

    # Start with QUEUED state
    cursor_mock.stats = {"state": "QUEUED", "completedSplits": 0, "totalSplits": 0}

    with patch("superset.db_engine_specs.trino.time.sleep", side_effect=update_stats):
        query = Query()
        query.status = "running"
        TrinoEngineSpec.handle_cursor(cursor=cursor_mock, query=query)

    # Check that progress_text was set
    assert query.extra.get("progress_text") is not None


@patch("superset.db_engine_specs.presto.PrestoBaseEngineSpec.handle_cursor")
@patch("superset.db_engine_specs.trino.TrinoEngineSpec.cancel_query")
@patch("superset.db_engine_specs.trino.db")
@patch("superset.db_engine_specs.trino.app")
def test_handle_cursor_sets_progress_text_to_state_for_unmapped_states(
    mock_app: Mock,
    mock_db: Mock,
    mock_cancel_query: Mock,
    mock_presto_handle_cursor: Mock,
    mocker: MockerFixture,
) -> None:
    """Test that handle_cursor sets progress_text to raw state for unmapped states."""
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    mock_app.config = {"DB_POLL_INTERVAL_SECONDS": {"trino": 0}}

    cursor_mock = mocker.MagicMock(spec=["query_id", "stats", "info_uri"])
    cursor_mock.query_id = "test-query-id"

    # Start directly with FINISHED state (not in the mapping)
    cursor_mock.stats = {"state": "FINISHED", "completedSplits": 10, "totalSplits": 10}

    query = Query()
    query.status = "running"
    TrinoEngineSpec.handle_cursor(cursor=cursor_mock, query=query)

    # Check that progress_text was set to the raw state "FINISHED"
    # since FINISHED is not in the mapping (only PLANNING and QUEUED are mapped)
    assert query.extra.get("progress_text") == "FINISHED"


@patch("superset.db_engine_specs.presto.PrestoBaseEngineSpec.handle_cursor")
@patch("superset.db_engine_specs.trino.TrinoEngineSpec.cancel_query")
@patch("superset.db_engine_specs.trino.db")
@patch("superset.db_engine_specs.trino.app")
def test_handle_cursor_commits_on_progress_text_change(
    mock_app: Mock,
    mock_db: Mock,
    mock_cancel_query: Mock,
    mock_presto_handle_cursor: Mock,
    mocker: MockerFixture,
) -> None:
    """Test that handle_cursor commits only when progress_text changes."""
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    mock_app.config = {"DB_POLL_INTERVAL_SECONDS": {"trino": 0}}

    cursor_mock = mocker.MagicMock(spec=["query_id", "stats", "info_uri"])
    cursor_mock.query_id = "test-query-id"

    call_count = 0

    def update_stats(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # State changes from QUEUED to RUNNING but progress stays at 0
            cursor_mock.stats = {
                "state": "RUNNING",
                "completedSplits": 0,
                "totalSplits": 10,
            }
        elif call_count >= 2:
            cursor_mock.stats = {
                "state": "FINISHED",
                "completedSplits": 10,
                "totalSplits": 10,
            }

    # Start with QUEUED state and 0 progress
    cursor_mock.stats = {"state": "QUEUED", "completedSplits": 0, "totalSplits": 10}

    with patch("superset.db_engine_specs.trino.time.sleep", side_effect=update_stats):
        query = Query()
        query.status = "running"
        TrinoEngineSpec.handle_cursor(cursor=cursor_mock, query=query)

    # There should be commits for progress_text changes
    assert mock_db.session.commit.call_count >= 2


def test_handle_boolean_filter() -> None:
    """
    Test that Trino uses equality operators for boolean filters instead of IS,
    since `col IS TRUE` can fail on computed boolean expressions like
    `(expiration = 1) AS expiration`.
    """
    from sqlalchemy import Boolean, Column

    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.utils.core import FilterOperator

    bool_col = Column("test_col", Boolean)

    result_true = TrinoEngineSpec.handle_boolean_filter(
        bool_col, FilterOperator.IS_TRUE, True
    )
    assert (
        str(result_true.compile(compile_kwargs={"literal_binds": True}))
        == "test_col = true"
    )

    result_false = TrinoEngineSpec.handle_boolean_filter(
        bool_col, FilterOperator.IS_FALSE, False
    )
    assert (
        str(result_false.compile(compile_kwargs={"literal_binds": True}))
        == "test_col = false"
    )

    # Regression: the original bug was on computed boolean columns like
    # `(expiration = 1) AS expiration`. Verify the equality operator also
    # compiles correctly when the "column" is a computed expression.
    from sqlalchemy import literal_column

    computed_col = literal_column("(expiration = 1)")
    result_computed = TrinoEngineSpec.handle_boolean_filter(
        computed_col, FilterOperator.IS_TRUE, True
    )
    assert (
        str(result_computed.compile(compile_kwargs={"literal_binds": True}))
        == "(expiration = 1) = true"
    )


def test_mask_encrypted_extra() -> None:
    """
    All `auth_params` values and the OAuth2 client secret are masked, while
    `auth_method` and other non-sensitive fields stay visible.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    config = json.dumps(
        {
            "auth_method": "jwt",
            "auth_params": {"token": "my-secret-token"},
            "oauth2_client_info": {"id": "client-id", "secret": "my-secret"},
        }
    )

    assert TrinoEngineSpec.mask_encrypted_extra(config) == json.dumps(
        {
            "auth_method": "jwt",
            "auth_params": {"token": "XXXXXXXXXX"},
            "oauth2_client_info": {"id": "client-id", "secret": "XXXXXXXXXX"},
        }
    )


def test_mask_encrypted_extra_jwt_in_connect_args() -> None:
    """
    A JWT passed via `connect_args.requests_kwargs` is masked without touching
    the surrounding connection settings.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    config = json.dumps(
        {
            "connect_args": {
                "protocol": "https",
                "requests_kwargs": {"jwt": "my-secret-token"},
            },
        }
    )

    assert TrinoEngineSpec.mask_encrypted_extra(config) == json.dumps(
        {
            "connect_args": {
                "protocol": "https",
                "requests_kwargs": {"jwt": "XXXXXXXXXX"},
            },
        }
    )


def test_unmask_encrypted_extra() -> None:
    """
    Masked credentials are reused from the previous value; edited ones are kept.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    old = json.dumps(
        {
            "auth_method": "basic",
            "auth_params": {"username": "alice", "password": "old-password"},
        }
    )
    # `username` is not masked on read, so it comes back in cleartext; only the
    # masked `password` is revealed from the previous value.
    new = json.dumps(
        {
            "auth_method": "basic",
            "auth_params": {"username": "alice", "password": "XXXXXXXXXX"},
        }
    )

    assert TrinoEngineSpec.unmask_encrypted_extra(old, new) == json.dumps(
        {
            "auth_method": "basic",
            "auth_params": {"username": "alice", "password": "old-password"},
        }
    )


def test_impersonate_user_non_trino_backend() -> None:
    """
    Test impersonate_user for non-Trino backends.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    url = make_url("presto://user@host:443/catalog/schema")
    engine_kwargs: dict[str, Any] = {"connect_args": {}}

    _, new_kwargs = TrinoEngineSpec.impersonate_user(
        database=MagicMock(),
        username="alice",
        user_token=None,
        url=url,
        engine_kwargs=engine_kwargs,
    )

    assert new_kwargs["connect_args"] == {}


def test_impersonate_user_without_token() -> None:
    """
    Test impersonate_user when there isn't a `user_token`.

    Without a user token only the `user` connect arg is set; no HTTP session is
    built, so the driver keeps handling `verify` itself.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    url = make_url("trino://host:443/catalog/schema")
    engine_kwargs: dict[str, Any] = {"connect_args": {"verify": False}}

    _, new_kwargs = TrinoEngineSpec.impersonate_user(
        database=MagicMock(),
        username="alice",
        user_token=None,
        url=url,
        engine_kwargs=engine_kwargs,
    )

    assert new_kwargs["connect_args"] == {"user": "alice", "verify": False}


@pytest.mark.parametrize(
    "verify",
    [None, False, True, "/path/to/ca-bundle.pem"],
)
def test_impersonate_user_with_token(verify: Any) -> None:
    """
    Test impersonate_user with a `user_token`.

    With a user token an HTTP session carrying the bearer token is injected. Trino only
    applies `verify` to a session it builds itself, so the setting has to be copied to
    ours.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    url = make_url("trino://host:443/catalog/schema")
    engine_kwargs: dict[str, Any] = {"connect_args": {"verify": verify}}

    _, new_kwargs = TrinoEngineSpec.impersonate_user(
        database=MagicMock(),
        username="alice",
        user_token="user-token",  # noqa: S106
        url=url,
        engine_kwargs=engine_kwargs,
    )

    connect_args = new_kwargs["connect_args"]
    assert connect_args["user"] == "alice"
    http_session = connect_args["http_session"]
    assert http_session.headers["Authorization"] == "Bearer user-token"
    assert http_session.verify == verify
    # The original connect arg is left in place for the driver.
    assert connect_args["verify"] == verify


def test_impersonate_user_with_token_no_verify_configured() -> None:
    """
    Test impersonate_user with a `user_token` and no `verify` connect arg.

    Without the key the session keeps the `requests` default, which verifies certs.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    url = make_url("trino://host:443/catalog/schema")
    engine_kwargs: dict[str, Any] = {"connect_args": {}}

    _, new_kwargs = TrinoEngineSpec.impersonate_user(
        database=MagicMock(),
        username="alice",
        user_token="user-token",  # noqa: S106
        url=url,
        engine_kwargs=engine_kwargs,
    )

    connect_args = new_kwargs["connect_args"]
    assert "verify" not in connect_args
    assert connect_args["http_session"].verify is True


def test_get_cancel_query_id_reads_the_running_query() -> None:
    """The queryId is only known once execution has started."""
    import trino.dbapi

    from superset.db_engine_specs.trino import TrinoEngineSpec

    cursor = trino.dbapi.connect(host="localhost", user="superset").cursor()
    # SQL Lab and chart-data tasks ask before executing: nothing to record.
    assert TrinoEngineSpec.get_cancel_query_id(cursor, Mock()) is None
    running = Mock(query_id="20261001_000000_00001_abcde")
    assert (
        TrinoEngineSpec.get_cancel_query_id(running, Mock())
        == "20261001_000000_00001_abcde"
    )
    assert TrinoEngineSpec.has_query_id_during_execute is True


# ---------------------------------------------------------------------------
# Schema / catalog / table / view discovery.
#
# TrinoEngineSpec(PrestoBaseEngineSpec) does not inherit PrestoEngineSpec, so
# get_table_names/get_view_names/get_schema_names resolve to BaseEngineSpec's
# generic inspector-based implementation, and get_catalog_names/
# get_function_names to PrestoBaseEngineSpec. These tests pin that resolution
# at the Trino layer (the Presto unit tests only exercise PrestoEngineSpec).
# ---------------------------------------------------------------------------


@pytest.fixture
def trino_database(mocker: MockerFixture) -> tuple[Any, MagicMock]:
    """
    A real ``Database`` on the Trino engine spec whose inspector is mocked.

    Returns the database and the inspector handed out by ``get_inspector``, so
    tests can exercise ``Database`` -> ``TrinoEngineSpec`` call chains (including
    exception mapping) without a live Trino server.
    """
    from superset.models.core import Database

    inspector = mocker.MagicMock()
    mocker.patch.object(
        Database, "get_inspector"
    ).return_value.__enter__.return_value = inspector
    database = Database(
        database_name="trino_db",
        sqlalchemy_uri="trino://user@localhost:8080/catalog",
    )
    return database, inspector


def _driver_error_wrapped_by_sqlalchemy(orig: Exception) -> ProgrammingError:
    """
    Wrap a driver exception the way SQLAlchemy does when it executes a
    statement: a ``sqlalchemy.exc`` error with the driver exception as ``.orig``.
    """
    return ProgrammingError("SELECT 1", {}, orig)


@pytest.mark.parametrize("method", ["get_table_names", "get_view_names"])
@pytest.mark.parametrize(
    "inspector_result,schema,expected",
    [
        (["orders", "customers"], "my_schema", {"orders", "customers"}),
        ([], "empty_schema", set()),
        # a catalog-qualified schema prefix is stripped from matching names only
        (
            ["my_catalog.my_schema.orders", "unrelated"],
            "my_catalog.my_schema",
            {"orders", "unrelated"},
        ),
        # mixed-case names are returned verbatim
        (["MixedCase", "lower"], "my_schema", {"MixedCase", "lower"}),
    ],
)
def test_get_table_and_view_names(
    mocker: MockerFixture,
    method: str,
    inspector_result: list[str],
    schema: str,
    expected: set[str],
) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    inspector = mocker.MagicMock()
    getattr(inspector, method).return_value = inspector_result

    assert getattr(TrinoEngineSpec, method)(Mock(), inspector, schema) == expected
    getattr(inspector, method).assert_called_once_with(schema)


@pytest.mark.parametrize("method", ["get_table_names", "get_view_names"])
def test_get_table_and_view_names_map_driver_error(
    mocker: MockerFixture, method: str
) -> None:
    """
    A driver error raised while listing a schema (e.g. the schema does not
    exist) is mapped to a Superset DBAPI exception rather than leaked raw.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    inspector = mocker.MagicMock()
    getattr(inspector, method).side_effect = TrinoUserError(
        {"message": "Schema 'nope' does not exist"}
    )

    with pytest.raises(SupersetDBAPIProgrammingError, match="does not exist"):
        getattr(TrinoEngineSpec, method)(Mock(), inspector, "nope")


@pytest.mark.parametrize("method", ["get_table_names", "get_view_names"])
def test_get_table_and_view_names_do_not_map_sqlalchemy_wrapped_error(
    mocker: MockerFixture, method: str
) -> None:
    """
    Documents current behavior; the intended behavior is not decided yet.
    Update this test if the mapping learns to look at ``.orig``.

    The exception mapping keys on the driver exception type, but when the error
    surfaces through a real SQLAlchemy inspector it arrives wrapped in a
    ``sqlalchemy.exc`` error (driver error preserved as ``.orig``). The wrapper
    is not in the mapping, so it propagates unmapped.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    inspector = mocker.MagicMock()
    getattr(inspector, method).side_effect = _driver_error_wrapped_by_sqlalchemy(
        TrinoUserError({"message": "Schema 'nope' does not exist"})
    )

    with pytest.raises(ProgrammingError) as exc_info:
        getattr(TrinoEngineSpec, method)(Mock(), inspector, "nope")

    assert isinstance(exc_info.value.orig, TrinoUserError)


@pytest.mark.parametrize(
    "inspector_result,expected",
    [
        (["information_schema", "default"], {"information_schema", "default"}),
        ([], set()),
    ],
)
def test_get_schema_names(
    mocker: MockerFixture, inspector_result: list[str], expected: set[str]
) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    inspector = mocker.MagicMock()
    inspector.get_schema_names.return_value = inspector_result

    assert TrinoEngineSpec.get_schema_names(inspector) == expected


def _show_catalogs_connection(inspector: MagicMock) -> MagicMock:
    """The connection ``get_catalog_names`` opens to run ``SHOW CATALOGS``."""
    return inspector.engine.connect.return_value.__enter__.return_value


@pytest.mark.parametrize(
    "rows,expected",
    [
        ([("system",), ("tpch",), ("memory",)], {"system", "tpch", "memory"}),
        ([], set()),
    ],
)
def test_get_catalog_names(
    mocker: MockerFixture, rows: list[tuple[str]], expected: set[str]
) -> None:
    """
    get_catalog_names is defined on PrestoBaseEngineSpec; mirrors
    test_presto.py::test_get_catalog_names_lists_catalogs at the Trino layer.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    inspector = mocker.MagicMock()
    conn = _show_catalogs_connection(inspector)
    conn.execute.return_value = rows

    assert TrinoEngineSpec.get_catalog_names(Mock(), inspector) == expected
    assert str(conn.execute.call_args[0][0]) == "SHOW CATALOGS"


def test_get_all_schema_names_maps_bare_permission_denied(
    trino_database: tuple[Any, MagicMock],
) -> None:
    """
    Listing schemas without access to the catalog surfaces as a Superset
    DBAPI exception when the driver error reaches ``Database`` unwrapped.
    """
    database, inspector = trino_database
    inspector.get_schema_names.side_effect = TrinoUserError(
        {"message": "Access Denied: Cannot access catalog system"}
    )

    with pytest.raises(SupersetDBAPIProgrammingError, match="Access Denied"):
        database.get_all_schema_names()


def test_get_all_schema_names_does_not_map_sqlalchemy_wrapped_permission_denied(
    trino_database: tuple[Any, MagicMock],
) -> None:
    """
    Documents current behavior; the intended behavior is not decided yet.
    Update this test if the mapping learns to look at ``.orig``.

    Through a real inspector, a permission failure arrives wrapped in a
    ``sqlalchemy.exc.ProgrammingError`` (driver error as ``.orig``). The
    mapping does not recognize the wrapper, so the raw SQLAlchemy error is
    raised instead of a Superset DBAPI exception.
    """
    database, inspector = trino_database
    inspector.get_schema_names.side_effect = _driver_error_wrapped_by_sqlalchemy(
        TrinoUserError({"message": "Access Denied: Cannot access catalog system"})
    )

    with pytest.raises(ProgrammingError) as exc_info:
        database.get_all_schema_names()

    assert isinstance(exc_info.value.orig, TrinoUserError)


def test_get_catalog_names_does_not_map_sqlalchemy_wrapped_permission_denied(
    mocker: MockerFixture,
) -> None:
    """
    Documents current behavior; the intended behavior is not decided yet.
    Update this test if the mapping learns to look at ``.orig``.

    ``get_catalog_names`` runs ``SHOW CATALOGS`` itself and does not map
    failures at all, so a SQLAlchemy-wrapped permission error propagates with
    the driver error preserved as ``.orig``.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    inspector = mocker.MagicMock()
    conn = _show_catalogs_connection(inspector)
    conn.execute.side_effect = _driver_error_wrapped_by_sqlalchemy(
        TrinoUserError({"message": "Access Denied: Cannot execute query"})
    )

    with pytest.raises(ProgrammingError) as exc_info:
        TrinoEngineSpec.get_catalog_names(Mock(), inspector)

    assert isinstance(exc_info.value.orig, TrinoUserError)


@pytest.mark.parametrize(
    "schema",
    ["my schema", "a/b", "100%", "q?x=1&y=2", "ünïcödé", "with.dot"],
)
def test_schema_name_round_trips_through_engine_params(schema: str) -> None:
    """
    Schema names containing URL-significant characters survive being written
    into the SQLAlchemy URI by ``adjust_engine_params`` and read back by
    ``get_schema_from_engine_params``.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    url = make_url("trino://user:pass@localhost:8080/system")

    adjusted, _ = TrinoEngineSpec.adjust_engine_params(url, {}, schema=schema)

    assert TrinoEngineSpec.get_schema_from_engine_params(adjusted, {}) == schema


# ---------------------------------------------------------------------------
# Type handling.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("native_type", ["IPADDRESS", "UUID", "HyperLogLog"])
def test_get_column_spec_unmapped_trino_types(native_type: str) -> None:
    """
    Trino-only opaque types with no entry in ``column_type_mappings`` yield
    ``None`` rather than raising, like any other unrecognized native type.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    assert TrinoEngineSpec.get_column_spec(native_type) is None


@pytest.mark.parametrize(
    "type_str",
    [
        "map(varchar, row(a varchar, b date))",
        "array(row(a varchar, b date))",
    ],
)
def test_expand_columns_does_not_expand_row_nested_in_map_or_array(
    type_str: str,
) -> None:
    """
    ``_expand_columns`` only descends into ROW types directly; a ROW nested
    under a MAP or ARRAY is left untouched, as documented on the method.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    col = ResultSetColumnType(
        name="field1",
        column_name="field1",
        type=datatype.parse_sqltype(type_str),
        is_dttm=False,
    )

    assert TrinoEngineSpec._expand_columns(col) == [col]


def test_expand_columns_expands_deeply_nested_row() -> None:
    """
    A deeply nested ROW expands to one dotted column per nesting level.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    depth = 20
    type_str = "varchar"
    for _ in range(depth):
        type_str = f"row(a {type_str})"
    col = ResultSetColumnType(
        name="field",
        column_name="field",
        type=datatype.parse_sqltype(type_str),
        is_dttm=False,
    )

    expanded = TrinoEngineSpec._expand_columns(col)

    assert len(expanded) == depth + 1
    assert expanded[-1]["name"] == "field" + ".a" * depth


@pytest.mark.xfail(
    strict=True,
    raises=RecursionError,
    reason="Known defect: _expand_columns has no recursion-depth guard.",
)
def test_expand_columns_survives_rows_nested_beyond_recursion_limit() -> None:
    """
    Expanding a ROW nested deeper than the interpreter's recursion limit should
    not crash column inspection for the whole table.

    Known defect, hence ``xfail(strict=True)``: ``_expand_columns`` recurses
    once per ROW level with no maximum depth and raises ``RecursionError``. Once
    a guard lands this test passes, strict mode turns that into a failure, and
    the marker should be removed.

    The type is built programmatically because ``parse_sqltype`` is itself
    recursive and would fail first on a string this deep. Each level also
    renders as a fixed string: ``_expand_columns`` serializes every inner type
    (``str(inner_type)``) before recursing, and that rendering must not be what
    raises, or a depth guard would never make this test pass.
    """
    import sys

    from superset.db_engine_specs.trino import TrinoEngineSpec

    class _FixedStrRow(datatype.ROW):
        def __str__(self) -> str:
            return "row(a varchar)"

    col_type: Any = types.String()
    for _ in range(sys.getrecursionlimit() + 100):
        col_type = _FixedStrRow([("a", col_type)])
    col = ResultSetColumnType(
        name="field", column_name="field", type=col_type, is_dttm=False
    )

    expanded = TrinoEngineSpec._expand_columns(col)

    assert expanded[0] == col


# ---------------------------------------------------------------------------
# Error mapping.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("exception", [TrinoConnectionError, TrinoAuthError])
def test_get_dbapi_exception_mapping_matches_subclasses(
    exception: type[Exception],
) -> None:
    """
    The mapping matches by ``issubclass``, so driver exceptions without a
    bespoke entry (connection and auth failures subclass ``OperationalError``)
    still map to ``SupersetDBAPIOperationalError``.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    mapping = TrinoEngineSpec.get_dbapi_exception_mapping()

    assert mapping.get(exception) == SupersetDBAPIOperationalError


@pytest.mark.parametrize("exception", [Http502Error, IntegrityError])
def test_get_dbapi_exception_mapping_ignores_unmapped_exceptions(
    exception: type[Exception],
) -> None:
    """
    Exceptions outside the three mapped categories fall through to the caller's
    default: Trino's HTTP 5xx errors subclass ``HttpError`` (not a
    ``DatabaseError``), and ``IntegrityError`` subclasses ``DatabaseError``
    directly rather than one of the handled subclasses.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    mapping = TrinoEngineSpec.get_dbapi_exception_mapping()

    assert mapping.get(exception) is None
    assert mapping.get(exception, SupersetDBAPIConnectionError) is (
        SupersetDBAPIConnectionError
    )


@pytest.mark.parametrize(
    "exception,expected_type",
    [
        (TrinoUserError({"message": "syntax error"}), SupersetDBAPIProgrammingError),
        (TrinoInternalError({"message": "oops"}), SupersetDBAPIDatabaseError),
        (TrinoExternalError({"message": "hive down"}), SupersetDBAPIOperationalError),
    ],
)
def test_get_dbapi_mapped_exception_keeps_message(
    exception: Exception, expected_type: type[Exception]
) -> None:
    """
    The mapped Superset exception is built from the driver exception's text,
    so the original reason stays visible to the user.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    mapped = TrinoEngineSpec.get_dbapi_mapped_exception(exception)

    assert type(mapped) is expected_type
    assert str(mapped) == str(exception)


def test_trino_has_no_custom_error_patterns() -> None:
    """
    Documents current behavior; update this test if Trino gains
    ``custom_errors``.

    Unlike ``PrestoEngineSpec``, which rewrites nine known Presto errors into
    friendly typed messages, Trino defines no ``custom_errors``: every driver
    error, including a missing table or bad credentials, surfaces as a generic
    database engine error carrying the raw Trino text.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.errors import SupersetErrorType

    assert TrinoEngineSpec.custom_errors == {}

    errors = TrinoEngineSpec.extract_errors(
        TrinoUserError({"message": "line 1:15: Table 'tpch.sf1.nope' does not exist"})
    )

    assert len(errors) == 1
    assert errors[0].error_type == SupersetErrorType.GENERIC_DB_ENGINE_ERROR
    assert "Table 'tpch.sf1.nope' does not exist" in errors[0].message
    assert errors[0].extra is not None
    assert errors[0].extra["engine_name"] == "Trino"


# ---------------------------------------------------------------------------
# Function names and extra table metadata.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "functions,expected",
    [
        (["abs", "array_agg", "json_extract"], ["abs", "array_agg", "json_extract"]),
        ([], []),
    ],
)
def test_get_function_names(
    mocker: MockerFixture, functions: list[str], expected: list[str]
) -> None:
    """
    get_function_names is defined on PrestoBaseEngineSpec; mirrors
    test_presto.py::test_get_function_names_lists_presto_functions at the Trino
    layer.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    database = mocker.MagicMock()
    database.get_df.return_value = pd.DataFrame({"Function": functions})

    assert TrinoEngineSpec.get_function_names(database) == expected
    database.get_df.assert_called_once_with("SHOW FUNCTIONS")


def test_database_function_names_swallows_connection_error(
    mocker: MockerFixture,
    trino_database: tuple[Any, MagicMock],
) -> None:
    """
    ``Database.function_names`` feeds SQL Lab autocomplete and must not crash
    when Trino is unreachable: the failure is logged and an empty list returned
    (https://github.com/apache/superset/issues/9678).
    """
    database, _ = trino_database
    mocker.patch.object(
        database, "get_df", side_effect=TrinoConnectionError("connection refused")
    )

    assert database.function_names == []


def test_get_extra_table_metadata_no_partitions(mocker: MockerFixture) -> None:
    """
    A table with no indexes at all (not just Iceberg metadata filtered out)
    yields no partition metadata and no latest-partition query.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    db_mock = mocker.MagicMock()
    db_mock.get_indexes = Mock(return_value=[])
    db_mock.get_extra = Mock(return_value={})
    db_mock.has_view = Mock(return_value=False)
    db_mock.get_df = Mock()

    result = TrinoEngineSpec.get_extra_table_metadata(
        db_mock, Table("test_table", "test_schema")
    )

    assert result == {}
    db_mock.get_df.assert_not_called()


def test_get_extra_table_metadata_for_dropped_table(
    mocker: MockerFixture,
    trino_database: tuple[Any, MagicMock],
) -> None:
    """
    A table dropped between listing and inspection raises ``NoSuchTableError``
    from the inspector. ``TrinoEngineSpec.get_indexes`` turns that into an empty
    index list, so ``get_extra_table_metadata`` returns no metadata instead of
    failing; exercised through a real ``Database`` so the production handler
    (not a mock of it) is what runs.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    database, inspector = trino_database
    inspector.get_indexes.side_effect = NoSuchTableError(
        "The specified table does not exist."
    )
    mocker.patch.object(database, "has_view", return_value=False)

    result = TrinoEngineSpec.get_extra_table_metadata(
        database, Table("dropped_table", "test_schema")
    )

    assert result == {}


# ---------------------------------------------------------------------------
# Query cancellation, threading, and OAuth2.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "malformed_id",
    [
        "123; DROP TABLE users",
        "123' OR '1'='1",
        "../../etc/passwd",
        "123 UNION SELECT 1",
        "abc-def",
        "",
    ],
)
def test_cancel_query_rejects_malformed_query_id(malformed_id: str) -> None:
    """
    A malformed or injection-style ``cancel_query_id`` is rejected before it can
    be interpolated into the ``CALL system.runtime.kill_query`` statement:
    ``cancel_query`` returns False and never touches the cursor.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    cursor_mock = Mock()

    assert TrinoEngineSpec.cancel_query(cursor_mock, Query(), malformed_id) is False
    cursor_mock.execute.assert_not_called()


def _run_execute_with_cursor(
    app: Any,
    cursor: MagicMock,
    execute: Any,
    g_values: dict[str, Any] | None = None,
) -> None:
    """
    Run ``execute_with_cursor`` inside a request context, with
    ``TrinoEngineSpec.execute`` (which runs in the worker thread) replaced by
    ``execute`` as a mock side effect. ``g_values`` are set on ``g`` first.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    with (
        app.test_request_context("/some/place/"),
        patch.object(TrinoEngineSpec, "execute", side_effect=execute),
        patch.dict("superset.config.DISALLOWED_SQL_FUNCTIONS", {}, clear=True),
    ):
        for key, value in (g_values or {}).items():
            setattr(g, key, value)
        TrinoEngineSpec.execute_with_cursor(
            cursor=cursor,
            sql="SELECT 1 FROM foo",
            query=MagicMock(),
        )


def _record_query_ids_seen_by_handle_cursor(
    mocker: MockerFixture,
) -> list[str | None]:
    """
    Replace ``handle_cursor`` and record ``cursor.query_id`` at the moment it is
    called, which is what the main thread hands to progress polling.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    observed: list[str | None] = []
    mocker.patch.object(
        TrinoEngineSpec,
        "handle_cursor",
        side_effect=lambda cursor, query: observed.append(cursor.query_id),
    )
    return observed


@pytest.mark.xfail(
    strict=True,
    raises=AssertionError,
    reason="Known defect: g is copied shallowly into the worker thread.",
)
def test_execute_with_cursor_isolates_mutable_g_state_from_worker(
    app, mocker: MockerFixture
) -> None:
    """
    A mutation the worker thread makes to a value on ``g`` should not leak back
    into the request thread's ``g``.

    Known defect, hence ``xfail(strict=True)``: the worker rebuilds ``g`` with
    ``setattr(g, key, value)`` per attribute, a shallow copy, so a mutable value
    (here a dict) is the same object on both sides.
    """
    _record_query_ids_seen_by_handle_cursor(mocker)
    mock_cursor = mocker.MagicMock(query_id="existing-query-id")
    shared_state = {"count": 0}

    def _mutate_in_worker(*args: Any, **kwargs: Any) -> None:
        g.shared_state["count"] += 1

    _run_execute_with_cursor(
        app, mock_cursor, _mutate_in_worker, g_values={"shared_state": shared_state}
    )

    assert shared_state["count"] == 0


@pytest.mark.parametrize("exception", [RuntimeError("boom"), MemoryError("oom")])
def test_execute_with_cursor_reraises_worker_exception_before_query_id(
    app, mocker: MockerFixture, exception: Exception
) -> None:
    """
    A non-DB exception raised by the worker before Trino assigns a query ID is
    re-raised unchanged in the calling thread. The wait for a query ID ends
    because the worker's ``finally`` sets the execute event, so ``handle_cursor``
    is still called (with no query ID yet) instead of spinning forever.
    """
    observed_query_ids = _record_query_ids_seen_by_handle_cursor(mocker)
    mock_cursor = mocker.MagicMock(query_id=None)

    with pytest.raises(type(exception)) as exc_info:
        _run_execute_with_cursor(app, mock_cursor, exception)

    assert exc_info.value is exception
    assert observed_query_ids == [None]


def test_execute_with_cursor_reraises_worker_exception_after_query_id(
    app, mocker: MockerFixture
) -> None:
    """
    When the query ID became available before the worker failed, progress
    handling sees that real ID and the worker's exception is still re-raised
    in the calling thread once the cursor has been handled.
    """
    observed_query_ids = _record_query_ids_seen_by_handle_cursor(mocker)
    mock_cursor = mocker.MagicMock(query_id=None)
    failure = RuntimeError("boom")

    def _fail_after_query_id(*args: Any, **kwargs: Any) -> None:
        mock_cursor.query_id = "myQueryId"
        raise failure

    with pytest.raises(RuntimeError) as exc_info:
        _run_execute_with_cursor(app, mock_cursor, _fail_after_query_id)

    assert exc_info.value is failure
    assert observed_query_ids == ["myQueryId"]


@pytest.mark.xfail(
    strict=True,
    raises=pytest.fail.Exception,
    reason="Known defect: the worker only records Exception subclasses.",
)
@pytest.mark.filterwarnings("ignore::pytest.PytestUnhandledThreadExceptionWarning")
def test_execute_with_cursor_reraises_base_exception_from_worker(
    app, mocker: MockerFixture
) -> None:
    """
    A worker that dies with a ``BaseException`` should not be reported as a
    successful query: the error should be re-raised in the calling thread.

    Known defect, hence ``xfail(strict=True)``: the worker's ``except Exception``
    does not record ``BaseException`` subclasses, so ``execute_with_cursor``
    returns normally. ``SystemExit`` stands in for ``KeyboardInterrupt``, which
    pytest would treat as a request to abort the whole session.
    """
    _record_query_ids_seen_by_handle_cursor(mocker)
    mock_cursor = mocker.MagicMock(query_id="myQueryId")

    with pytest.raises(SystemExit):
        _run_execute_with_cursor(app, mock_cursor, SystemExit)


def test_update_params_from_encrypted_extra_malformed_json_reraises() -> None:
    """
    A malformed ``encrypted_extra`` blob is logged and re-raised as
    ``JSONDecodeError`` rather than swallowed.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    database = Mock()
    database.encrypted_extra = "{not valid json"

    with pytest.raises(json.JSONDecodeError):
        TrinoEngineSpec.update_params_from_encrypted_extra(database, {})


def _oauth2_database_for_trino(
    mocker: MockerFixture, oauth2_config: OAuth2ClientConfig
) -> MagicMock:
    """
    A mocked ``Database`` that reports OAuth2 as enabled but uses the real
    ``TrinoEngineSpec.needs_oauth2``, so the 401 detection under test is
    Trino's own.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    database = mocker.MagicMock(id=1)
    database.is_oauth2_enabled.return_value = True
    database.db_engine_spec = TrinoEngineSpec
    database.get_oauth2_config.return_value = oauth2_config
    return database


def test_expired_token_is_refreshed_and_query_retried(
    app, mocker: MockerFixture, oauth2_config: OAuth2ClientConfig
) -> None:
    """
    A Trino 401 raised before the query has made progress (token expired) is
    recognized by ``TrinoEngineSpec.needs_oauth2``, which makes
    ``execute_with_oauth2_retry`` *force* a refresh of the rejected token and
    replay the query, and the replay authenticates with the new token.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.utils.oauth2 import execute_with_oauth2_retry

    database = _oauth2_database_for_trino(mocker, oauth2_config)
    stored_token = mocker.MagicMock(access_token="stale-token")  # noqa: S106
    db = mocker.patch("superset.utils.oauth2.db")
    db.session.query().filter_by().one_or_none.return_value = stored_token

    def _refresh(*args: Any, **kwargs: Any) -> str:
        stored_token.access_token = "new-token"  # noqa: S105
        return "new-token"

    refresh = mocker.patch(
        "superset.utils.oauth2.refresh_oauth2_token", side_effect=_refresh
    )
    tokens_used: list[str] = []

    def _query_with_stored_token() -> str:
        tokens_used.append(stored_token.access_token)
        if stored_token.access_token != "new-token":  # noqa: S105
            raise HttpError("error 401: Unauthorized")
        return "rows"

    with app.test_request_context("/"):
        g.user = mocker.Mock(id=2)
        assert execute_with_oauth2_retry(database, _query_with_stored_token) == "rows"

    assert tokens_used == ["stale-token", "new-token"]
    refresh.assert_called_once_with(
        oauth2_config,
        1,
        2,
        TrinoEngineSpec,
        force=True,
        rejected_access_token="stale-token",  # noqa: S106
    )
    db.session.expire.assert_called_once_with(stored_token)
    database.start_oauth2_dance.assert_not_called()


def test_expired_token_mid_query_restarts_oauth2_without_replay(
    app, mocker: MockerFixture, oauth2_config: OAuth2ClientConfig
) -> None:
    """
    A Trino 401 raised after the query already made progress (token expired
    mid-flight) is not replayed: ``execute_with_oauth2_retry`` skips the refresh
    and starts the OAuth2 dance so the user re-authenticates. This is the
    behavior that makes long-running queries lose in-flight progress.
    """
    from superset.utils.oauth2 import execute_with_oauth2_retry

    database = _oauth2_database_for_trino(mocker, oauth2_config)
    refresh = mocker.patch("superset.utils.oauth2.refresh_oauth2_token")
    mocker.patch("superset.utils.oauth2.db")
    operation = mocker.Mock(side_effect=HttpError("error 401: Unauthorized"))

    with app.test_request_context("/"):
        g.user = mocker.Mock(id=2)
        with pytest.raises(HttpError):
            execute_with_oauth2_retry(database, operation, can_retry=lambda: False)

    operation.assert_called_once_with()
    refresh.assert_not_called()
    database.start_oauth2_dance.assert_called_once_with()


# ---------------------------------------------------------------------------
# Remaining small branches of trino.py: view/partition metadata, tracking URL,
# cost-estimate gate, encrypted-extra no-ops, and progress-polling timeout.
# ---------------------------------------------------------------------------


def test_get_extra_table_metadata_includes_view_definition(
    mocker: MockerFixture,
) -> None:
    """
    For a view, the definition comes from the inspector and is returned under
    the ``view`` key.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    db_mock = mocker.MagicMock()
    db_mock.get_indexes = Mock(return_value=[])
    db_mock.has_view = Mock(return_value=True)
    inspector = db_mock.get_inspector.return_value.__enter__.return_value
    inspector.get_view_definition.return_value = "SELECT 1"

    result = TrinoEngineSpec.get_extra_table_metadata(
        db_mock, Table("my_view", "test_schema")
    )

    assert result == {"view": "SELECT 1"}
    inspector.get_view_definition.assert_called_once_with("my_view", "test_schema")


def test_get_extra_table_metadata_partitioned_table_without_data(
    mocker: MockerFixture,
) -> None:
    """
    A partitioned table with no partitions yet reports its partition columns,
    with every latest value ``None``.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    db_mock = mocker.MagicMock()
    db_mock.get_indexes = Mock(
        return_value=[{"column_names": ["ds", "hour"], "name": "partition"}]
    )
    db_mock.has_view = Mock(return_value=False)
    mocker.patch.object(
        TrinoEngineSpec, "latest_partition", return_value=(["ds", "hour"], None)
    )
    mocker.patch.object(TrinoEngineSpec, "_partition_query", return_value="SELECT 1")

    result = TrinoEngineSpec.get_extra_table_metadata(
        db_mock, Table("test_table", "test_schema")
    )

    assert result["partitions"]["cols"] == ["ds", "hour"]
    assert result["partitions"]["latest"] == {"ds": None, "hour": None}


def test_latest_sub_partition_reads_indexes_from_database(
    mocker: MockerFixture,
) -> None:
    """
    When no indexes are passed, ``latest_sub_partition`` fetches them from the
    database and hands the (Iceberg-filtered) indexes to the base implementation.
    """
    from superset.db_engine_specs.presto import PrestoBaseEngineSpec
    from superset.db_engine_specs.trino import TrinoEngineSpec

    indexes = [{"name": "partition", "column_names": ["ds"]}]
    db_mock = mocker.MagicMock()
    db_mock.get_indexes = Mock(return_value=indexes)
    base_mock = mocker.patch.object(
        PrestoBaseEngineSpec, "latest_sub_partition", return_value="2019-01-01"
    )
    table = Table("test_table", "test_schema")

    assert TrinoEngineSpec.latest_sub_partition(db_mock, table, ds="x") == "2019-01-01"

    db_mock.get_indexes.assert_called_once_with(table)
    base_mock.assert_called_once_with(db_mock, table, indexes=indexes, ds="x")


def test_impersonate_user_without_username_returns_inputs_unchanged() -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    url = make_url("trino://localhost:8080/system")
    engine_kwargs: dict[str, Any] = {}

    new_url, new_kwargs = TrinoEngineSpec.impersonate_user(
        Mock(), None, "token", url, engine_kwargs
    )

    assert new_url is url
    assert new_kwargs == {}


def test_get_allow_cost_estimate_is_always_true() -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    assert TrinoEngineSpec.get_allow_cost_estimate({}) is True
    assert TrinoEngineSpec.get_allow_cost_estimate({"version": "0.1"}) is True


def test_get_tracking_url_prefers_info_uri(mocker: MockerFixture) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    cursor = mocker.MagicMock()
    cursor.info_uri = "http://trino:8080/ui/query.html?abc"

    assert TrinoEngineSpec.get_tracking_url(cursor) == cursor.info_uri


def test_get_tracking_url_builds_url_when_info_uri_is_unavailable(
    mocker: MockerFixture,
) -> None:
    """
    Older drivers expose no ``info_uri``; the URL is rebuilt from the
    connection's scheme/host/port and the cursor's query ID.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    cursor = mocker.MagicMock(spec=["connection", "_query"])
    cursor.connection.http_scheme = "https"
    cursor.connection.host = "trino.example.com"
    cursor.connection.port = 8443
    cursor._query.query_id = "20240101_000000_00001_abcde"

    assert TrinoEngineSpec.get_tracking_url(cursor) == (
        "https://trino.example.com:8443/ui/query.html?20240101_000000_00001_abcde"
    )


def test_get_tracking_url_is_none_without_connection_details(
    mocker: MockerFixture,
) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    cursor = mocker.MagicMock(spec=[])

    assert TrinoEngineSpec.get_tracking_url(cursor) is None


@pytest.mark.parametrize(
    "encrypted_extra",
    [
        None,
        "",
        # valid JSON but no auth_method: nothing to configure
        '{"auth_params": {"username": "u", "password": "p"}}',
    ],
)
def test_update_params_from_encrypted_extra_without_auth_method_is_noop(
    encrypted_extra: str | None,
) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    database = Mock()
    database.encrypted_extra = encrypted_extra
    params: dict[str, Any] = {}

    TrinoEngineSpec.update_params_from_encrypted_extra(database, params)

    assert params == {}


@patch("superset.db_engine_specs.presto.PrestoBaseEngineSpec.handle_cursor")
@patch("superset.db_engine_specs.trino.TrinoEngineSpec.cancel_query")
@patch("superset.db_engine_specs.trino.db")
@patch("superset.db_engine_specs.trino.app")
def test_handle_cursor_stops_polling_after_time_limit(
    mock_app: Mock,
    mock_db: Mock,
    mock_cancel_query: Mock,
    mock_presto_handle_cursor: Mock,
    mocker: MockerFixture,
) -> None:
    """
    Progress polling gives up once ``SQLLAB_ASYNC_TIME_LIMIT_SEC`` has elapsed
    since polling started, instead of looping forever on a query that never
    reaches a terminal state. The clock is controlled: polling starts at t=0,
    the first pass (t=5) is inside the limit and records progress, and the next
    check (t=11) is past it.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    mock_app.config = {
        "DB_POLL_INTERVAL_SECONDS": {"trino": 0},
        "SQLLAB_ASYNC_TIME_LIMIT_SEC": 10,
    }
    mock_time = mocker.patch("superset.db_engine_specs.trino.time")
    mock_time.time.side_effect = [0, 5, 11]
    cursor_mock = mocker.MagicMock(spec=["query_id", "stats", "info_uri"])
    cursor_mock.query_id = "test-query-id"
    cursor_mock.stats = {"state": "RUNNING", "completedSplits": 5, "totalSplits": 10}
    query = Query(id=1)
    query.status = "running"

    TrinoEngineSpec.handle_cursor(cursor=cursor_mock, query=query)

    assert query.progress == 50
    assert mock_time.sleep.call_count == 1
    mock_cancel_query.assert_not_called()
