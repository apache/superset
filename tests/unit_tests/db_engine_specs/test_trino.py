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
import json
from datetime import datetime
from typing import Any, Dict, Optional, Type
from unittest.mock import Mock, patch

import pandas as pd
import pytest
from pytest_mock import MockerFixture
from sqlalchemy import types

import superset.config
from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY, USER_AGENT
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)
from tests.unit_tests.fixtures.common import dttm


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
def test_get_extra_params(extra: Dict[str, Any], expected: Dict[str, Any]) -> None:
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

    params: Dict[str, Any] = {}
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

    params: Dict[str, Any] = {}
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

    params: Dict[str, Any] = {}
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

    params: Dict[str, Any] = {}
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
        params: Dict[str, Any] = {}
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
    sqla_type: Type[types.TypeEngine],
    attrs: Optional[Dict[str, Any]],
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
    dttm: datetime,
) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    assert_convert_dttm(TrinoEngineSpec, target_type, expected_result, dttm)


def test_extra_table_metadata() -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    db_mock = Mock()
    db_mock.get_indexes = Mock(
        return_value=[{"column_names": ["ds", "hour"], "name": "partition"}]
    )
    db_mock.get_extra = Mock(return_value={})
    db_mock.has_view_by_name = Mock(return_value=None)
    db_mock.get_df = Mock(return_value=pd.DataFrame({"ds": ["01-01-19"], "hour": [1]}))
    result = TrinoEngineSpec.extra_table_metadata(db_mock, "test_table", "test_schema")
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
    initial_extra: Dict[str, Any],
    final_extra: Dict[str, Any],
    mocker: MockerFixture,
) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.models.sql_lab import Query

    session_mock = mocker.MagicMock()
    query = Query(extra_json=json.dumps(initial_extra))
    TrinoEngineSpec.prepare_cancel_query(query=query, session=session_mock)
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
    cursor_mock.stats = {"queryId": query_id}
    session_mock = mocker.MagicMock()

    query = Query()

    if cancel_early:
        TrinoEngineSpec.prepare_cancel_query(query=query, session=session_mock)

    TrinoEngineSpec.handle_cursor(cursor=cursor_mock, query=query, session=session_mock)

    if cancel_early:
        assert cancel_query_mock.call_args[1]["cancel_query_id"] == query_id
    else:
        assert cancel_query_mock.call_args is None
