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
from collections import namedtuple
from datetime import datetime
from typing import Any, Optional
from unittest.mock import MagicMock, Mock, patch

import pandas as pd
import pytest
from flask import g, has_app_context
from pytest_mock import MockerFixture
from requests.exceptions import ConnectionError as RequestsConnectionError
from sqlalchemy import sql, text, types
from sqlalchemy.dialects import sqlite
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import NoSuchTableError
from trino.exceptions import TrinoExternalError, TrinoInternalError, TrinoUserError
from trino.sqlalchemy import datatype
from trino.sqlalchemy.dialect import TrinoDialect

import superset.config
from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY, USER_AGENT
from superset.db_engine_specs.exceptions import (
    SupersetDBAPIConnectionError,
    SupersetDBAPIDatabaseError,
    SupersetDBAPIOperationalError,
    SupersetDBAPIProgrammingError,
)
from superset.sql_parse import Table
from superset.superset_typing import ResultSetColumnType, SQLAColumnType, SQLType
from superset.utils import json
from superset.utils.core import GenericDataType
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
        ({}, {"engine_params": {"connect_args": {"source": USER_AGENT}}}),
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


@patch("superset.utils.core.create_ssl_cert_file")
def test_get_extra_params_with_server_cert(mock_create_ssl_cert_file: Mock) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    database = Mock()

    database.extra = json.dumps({})
    database.server_cert = "TEST_CERT"
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

    superset.config.ALLOWED_EXTRA_AUTHENTICATIONS = {}

    with pytest.raises(ValueError) as excinfo:
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
    from superset.db_engine_specs.trino import TrinoEngineSpec as spec

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
@patch("superset.db_engine_specs.trino.TrinoEngineSpec.cancel_query")
@patch("sqlalchemy.engine.Engine.connect")
def test_handle_cursor_early_cancel(
    engine_mock: Mock,
    cancel_query_mock: Mock,
    cancel_early: bool,
    mocker: MockerFixture,
) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    query_id = "myQueryId"

    cursor_mock = engine_mock.return_value.__enter__.return_value
    cursor_mock.query_id = query_id

    query = Query()

    if cancel_early:
        TrinoEngineSpec.prepare_cancel_query(query=query)

    TrinoEngineSpec.handle_cursor(cursor=cursor_mock, query=query)

    if cancel_early:
        assert cancel_query_mock.call_args[1]["cancel_query_id"] == query_id
    else:
        assert cancel_query_mock.call_args is None


def test_execute_with_cursor_in_parallel(app, mocker: MockerFixture):
    """Test that `execute_with_cursor` fetches query ID from the cursor"""
    from superset.db_engine_specs.trino import TrinoEngineSpec

    query_id = "myQueryId"

    mock_cursor = mocker.MagicMock()
    mock_cursor.query_id = None

    mock_query = mocker.MagicMock()

    def _mock_execute(*args, **kwargs):
        mock_cursor.query_id = query_id

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
    g.some_value = "some_value"

    def _mock_execute(*args, **kwargs):
        assert has_app_context()
        assert g.some_value == "some_value"

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
    mock_inspector.bind.execute().fetchall.return_value = [
        Row("field1", "row(a varchar, b date)"),
        Row("field2", "row(r1 row(a varchar, b varchar))"),
        Row("field3", "int"),
    ]

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

    mock_inspector.bind.execute.assert_called_with('SHOW COLUMNS FROM schema."table"')


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
            query_as='"field1"."a" AS "field1.a"',
        ),
        ResultSetColumnType(
            name="field1.b",
            column_name="field1.b",
            type=types.DATE(),
            is_dttm=True,
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
            query_as='"field2"."r1" AS "field2.r1"',
        ),
        ResultSetColumnType(
            name="field2.r1.a",
            column_name="field2.r1.a",
            type=types.VARCHAR(),
            is_dttm=False,
            query_as='"field2"."r1"."a" AS "field2.r1.a"',
        ),
        ResultSetColumnType(
            name="field2.r1.b",
            column_name="field2.r1.b",
            type=types.VARCHAR(),
            is_dttm=False,
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
    assert str(uri) == "trino://user:pass@localhost:8080/system/default"

    uri = TrinoEngineSpec.adjust_engine_params(
        url,
        {},
        schema="new_schema",
    )[0]
    assert str(uri) == "trino://user:pass@localhost:8080/system/new_schema"

    uri = TrinoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
    )[0]
    assert str(uri) == "trino://user:pass@localhost:8080/new_catalog/default"

    uri = TrinoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
        schema="new_schema",
    )[0]
    assert str(uri) == "trino://user:pass@localhost:8080/new_catalog/new_schema"


def test_adjust_engine_params_catalog_only() -> None:
    """
    Test the ``adjust_engine_params`` method when the URL has only the catalog.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec

    url = make_url("trino://user:pass@localhost:8080/system")

    uri = TrinoEngineSpec.adjust_engine_params(url, {})[0]
    assert str(uri) == "trino://user:pass@localhost:8080/system"

    uri = TrinoEngineSpec.adjust_engine_params(
        url,
        {},
        schema="new_schema",
    )[0]
    assert str(uri) == "trino://user:pass@localhost:8080/system/new_schema"

    uri = TrinoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
    )[0]
    assert str(uri) == "trino://user:pass@localhost:8080/new_catalog"

    uri = TrinoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
        schema="new_schema",
    )[0]
    assert str(uri) == "trino://user:pass@localhost:8080/new_catalog/new_schema"


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
        == f"""SELECT * FROM table \nWHERE partition_key = {expected_value}"""
    )
