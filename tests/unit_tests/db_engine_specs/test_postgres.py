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
from typing import Any, Dict, Optional, Type

import pytest
from sqlalchemy import types
from sqlalchemy.dialects.postgresql import DOUBLE_PRECISION, ENUM, JSON
from sqlalchemy.engine.url import make_url

from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)
from tests.unit_tests.fixtures.common import dttm


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "TO_DATE('2019-01-02', 'YYYY-MM-DD')"),
        (
            "DateTime",
            "TO_TIMESTAMP('2019-01-02 03:04:05.678900', 'YYYY-MM-DD HH24:MI:SS.US')",
        ),
        (
            "TimeStamp",
            "TO_TIMESTAMP('2019-01-02 03:04:05.678900', 'YYYY-MM-DD HH24:MI:SS.US')",
        ),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str, expected_result: Optional[str], dttm: datetime
) -> None:
    from superset.db_engine_specs.postgres import PostgresEngineSpec as spec

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        ("SMALLINT", types.SmallInteger, None, GenericDataType.NUMERIC, False),
        ("INTEGER", types.Integer, None, GenericDataType.NUMERIC, False),
        ("BIGINT", types.BigInteger, None, GenericDataType.NUMERIC, False),
        ("DECIMAL", types.Numeric, None, GenericDataType.NUMERIC, False),
        ("NUMERIC", types.Numeric, None, GenericDataType.NUMERIC, False),
        ("REAL", types.REAL, None, GenericDataType.NUMERIC, False),
        ("DOUBLE PRECISION", DOUBLE_PRECISION, None, GenericDataType.NUMERIC, False),
        ("MONEY", types.Numeric, None, GenericDataType.NUMERIC, False),
        # String
        ("CHAR", types.String, None, GenericDataType.STRING, False),
        ("VARCHAR", types.String, None, GenericDataType.STRING, False),
        ("TEXT", types.String, None, GenericDataType.STRING, False),
        ("ARRAY", types.String, None, GenericDataType.STRING, False),
        ("ENUM", ENUM, None, GenericDataType.STRING, False),
        ("JSON", JSON, None, GenericDataType.STRING, False),
        # Temporal
        ("DATE", types.Date, None, GenericDataType.TEMPORAL, True),
        ("TIMESTAMP", types.TIMESTAMP, None, GenericDataType.TEMPORAL, True),
        ("TIME", types.Time, None, GenericDataType.TEMPORAL, True),
        # Boolean
        ("BOOLEAN", types.Boolean, None, GenericDataType.BOOLEAN, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: Type[types.TypeEngine],
    attrs: Optional[Dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.postgres import PostgresEngineSpec as spec

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


def test_get_schema_from_engine_params() -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """
    from superset.db_engine_specs.postgres import PostgresEngineSpec

    assert (
        PostgresEngineSpec.get_schema_from_engine_params(
            make_url("postgresql://user:password@host/db1"), {}
        )
        is None
    )

    assert (
        PostgresEngineSpec.get_schema_from_engine_params(
            make_url("postgresql://user:password@host/db1"),
            {"options": "-csearch_path=secret"},
        )
        == "secret"
    )

    assert (
        PostgresEngineSpec.get_schema_from_engine_params(
            make_url("postgresql://user:password@host/db1"),
            {"options": "-c search_path = secret -cfoo=bar -c debug"},
        )
        == "secret"
    )

    with pytest.raises(Exception) as excinfo:
        PostgresEngineSpec.get_schema_from_engine_params(
            make_url("postgresql://user:password@host/db1"),
            {"options": "-csearch_path=secret,public"},
        )
    assert str(excinfo.value) == (
        "Multiple schemas are configured in the search path, which means "
        "Superset is unable to determine the schema of unqualified table "
        "names and enforce permissions."
    )


def test_adjust_engine_params() -> None:
    """
    Test the ``adjust_engine_params`` method.
    """
    from superset.db_engine_specs.postgres import PostgresEngineSpec

    uri = make_url("postgres://user:password@host/catalog")

    assert PostgresEngineSpec.adjust_engine_params(uri, {}, None, "secret") == (
        uri,
        {"options": "-csearch_path=secret"},
    )

    assert PostgresEngineSpec.adjust_engine_params(
        uri,
        {"foo": "bar", "options": "-csearch_path=default -c debug=1"},
        None,
        "secret",
    ) == (
        uri,
        {"foo": "bar", "options": "-csearch_path=secret -cdebug=1"},
    )
