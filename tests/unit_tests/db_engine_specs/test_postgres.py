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

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import column, types
from sqlalchemy.dialects.postgresql import DOUBLE_PRECISION, ENUM, JSON
from sqlalchemy.engine.url import make_url

from superset.db_engine_specs.postgres import PostgresEngineSpec as spec
from superset.exceptions import SupersetSecurityException
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


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
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
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
    sqla_type: type[types.TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


def test_get_schema_from_engine_params() -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """

    assert (
        spec.get_schema_from_engine_params(
            make_url("postgresql://user:password@host/db1"), {}
        )
        is None
    )

    assert (
        spec.get_schema_from_engine_params(
            make_url("postgresql://user:password@host/db1"),
            {"options": "-csearch_path=secret"},
        )
        == "secret"
    )

    assert (
        spec.get_schema_from_engine_params(
            make_url("postgresql://user:password@host/db1"),
            {"options": "-c search_path = secret -cfoo=bar -c debug"},
        )
        == "secret"
    )

    with pytest.raises(Exception) as excinfo:
        spec.get_schema_from_engine_params(
            make_url("postgresql://user:password@host/db1"),
            {"options": "-csearch_path=secret,public"},
        )
    assert str(excinfo.value) == (
        "Multiple schemas are configured in the search path, which means "
        "Superset is unable to determine the schema of unqualified table "
        "names and enforce permissions."
    )


def test_get_prequeries(mocker: MockerFixture) -> None:
    """
    Test the ``get_prequeries`` method.
    """
    database = mocker.MagicMock()

    assert spec.get_prequeries(database) == []
    assert spec.get_prequeries(database, schema="test") == ['set search_path = "test"']


def test_get_default_schema_for_query(mocker: MockerFixture) -> None:
    """
    Test the ``get_default_schema_for_query`` method.
    """

    database = mocker.MagicMock()
    query = mocker.MagicMock()

    query.sql = "SELECT * FROM some_table"
    query.schema = "foo"
    assert spec.get_default_schema_for_query(database, query) == "foo"

    query.sql = """
set
-- this is a tricky comment
search_path -- another one
= bar;
SELECT * FROM some_table;
    """
    with pytest.raises(SupersetSecurityException) as excinfo:
        spec.get_default_schema_for_query(database, query)
    assert (
        str(excinfo.value)
        == "Users are not allowed to set a search path for security reasons."
    )


def test_adjust_engine_params() -> None:
    """
    Test `adjust_engine_params`.

    The method can be used to adjust the catalog (database) dynamically.
    """

    adjusted = spec.adjust_engine_params(
        make_url("postgresql://user:password@host:5432/dev"),
        {},
        catalog="prod",
    )
    assert adjusted == (make_url("postgresql://user:password@host:5432/prod"), {})


def test_get_default_catalog() -> None:
    """
    Test `get_default_catalog`.
    """
    from superset.models.core import Database

    database = Database(
        database_name="postgres",
        sqlalchemy_uri="postgresql://user:password@host:5432/dev",
    )
    assert spec.get_default_catalog(database) == "dev"


@pytest.mark.parametrize(
    "time_grain,expected_result",
    [
        ("PT1S", "DATE_TRUNC('second', col)"),
        (
            "PT5S",
            "DATE_TRUNC('minute', col) + INTERVAL '5 seconds' * FLOOR(EXTRACT(SECOND FROM col) / 5)",
        ),
        (
            "PT30S",
            "DATE_TRUNC('minute', col) + INTERVAL '30 seconds' * FLOOR(EXTRACT(SECOND FROM col) / 30)",
        ),
        ("PT1M", "DATE_TRUNC('minute', col)"),
        (
            "PT5M",
            "DATE_TRUNC('hour', col) + INTERVAL '5 minutes' * FLOOR(EXTRACT(MINUTE FROM col) / 5)",
        ),
        (
            "PT10M",
            "DATE_TRUNC('hour', col) + INTERVAL '10 minutes' * FLOOR(EXTRACT(MINUTE FROM col) / 10)",
        ),
        (
            "PT15M",
            "DATE_TRUNC('hour', col) + INTERVAL '15 minutes' * FLOOR(EXTRACT(MINUTE FROM col) / 15)",
        ),
        (
            "PT30M",
            "DATE_TRUNC('hour', col) + INTERVAL '30 minutes' * FLOOR(EXTRACT(MINUTE FROM col) / 30)",
        ),
        ("PT1H", "DATE_TRUNC('hour', col)"),
        ("P1D", "DATE_TRUNC('day', col)"),
        ("P1W", "DATE_TRUNC('week', col)"),
        ("P1M", "DATE_TRUNC('month', col)"),
        ("P3M", "DATE_TRUNC('quarter', col)"),
        ("P1Y", "DATE_TRUNC('year', col)"),
    ],
)
def test_timegrain_expressions(time_grain: str, expected_result: str) -> None:
    """
    DB Eng Specs (postgres): Test time grain expressions
    """
    actual = str(
        spec.get_timestamp_expr(col=column("col"), pdf=None, time_grain=time_grain)
    )
    assert actual == expected_result
