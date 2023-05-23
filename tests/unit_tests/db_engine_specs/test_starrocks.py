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

from typing import Any, Dict, Optional, Type

import pytest
from sqlalchemy import types
from sqlalchemy.engine.url import make_url

from superset.db_engine_specs.starrocks import ARRAY, DOUBLE, MAP, STRUCT, TINYINT
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import assert_column_spec


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        # Numeric
        ("TINYINT", TINYINT, None, GenericDataType.NUMERIC, False),
        ("DECIMAL", types.DECIMAL, None, GenericDataType.NUMERIC, False),
        ("DOUBLE", DOUBLE, None, GenericDataType.NUMERIC, False),
        # String
        ("CHAR", types.CHAR, None, GenericDataType.STRING, False),
        ("VARCHAR", types.VARCHAR, None, GenericDataType.STRING, False),
        ("BINARY", types.String, None, GenericDataType.STRING, False),
        # Complex type
        ("ARRAY", ARRAY, None, GenericDataType.STRING, False),
        ("MAP", MAP, None, GenericDataType.STRING, False),
        ("STRUCT", STRUCT, None, GenericDataType.STRING, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: Type[types.TypeEngine],
    attrs: Optional[Dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.starrocks import StarRocksEngineSpec as spec

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


@pytest.mark.parametrize(
    "sqlalchemy_uri,connect_args,return_schema,return_connect_args",
    [
        (
            "starrocks://user:password@host/db1",
            {"param1": "some_value"},
            "db1",
            {"param1": "some_value"},
        ),
        (
            "starrocks://user:password@host/catalog1.db1",
            {"param1": "some_value"},
            "catalog1.db1",
            {"param1": "some_value"},
        ),
    ],
)
def test_adjust_engine_params(
    sqlalchemy_uri: str,
    connect_args: Dict[str, Any],
    return_schema: str,
    return_connect_args: Dict[str, Any],
) -> None:
    from superset.db_engine_specs.starrocks import StarRocksEngineSpec

    url = make_url(sqlalchemy_uri)
    returned_url, returned_connect_args = StarRocksEngineSpec.adjust_engine_params(
        url, connect_args
    )
    assert returned_url.database == return_schema
    assert returned_connect_args == return_connect_args


def test_get_schema_from_engine_params() -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """
    from superset.db_engine_specs.starrocks import StarRocksEngineSpec

    assert (
        StarRocksEngineSpec.get_schema_from_engine_params(
            make_url("starrocks://localhost:9030/hive.default"),
            {},
        )
        == "default"
    )

    assert (
        StarRocksEngineSpec.get_schema_from_engine_params(
            make_url("starrocks://localhost:9030/hive"),
            {},
        )
        is None
    )
