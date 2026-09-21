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
# pylint: disable=invalid-name, unused-argument, import-outside-toplevel, redefined-outer-name
from __future__ import annotations

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import types
from sqlalchemy.engine.url import make_url

from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import assert_column_spec


@pytest.mark.parametrize(
    "native_type,sqla_type,generic_type,is_dttm",
    [
        ("DATETIME", types.DateTime, GenericDataType.TEMPORAL, True),
        ("TIMESTAMP", types.TIMESTAMP, GenericDataType.TEMPORAL, True),
        ("DATE", types.Date, GenericDataType.TEMPORAL, True),
        ("TIME", types.Time, GenericDataType.TEMPORAL, True),
        ("BOOLEAN", types.Boolean, GenericDataType.BOOLEAN, False),
        ("INTEGER", types.Integer, GenericDataType.NUMERIC, False),
        ("TEXT", types.String, GenericDataType.STRING, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    """
    Test the type names the ``d1`` dialect of sqlalchemy-d1 0.2.0 reports.

    The dialect prints ``DATETIME``, ``TIMESTAMP``, ``DATE``, ``TIME`` and
    ``BOOLEAN`` for columns declared with those types, so they must map to
    temporal and boolean columns rather than to strings and numbers.
    """
    from superset.db_engine_specs.d1 import CloudflareD1EngineSpec as spec  # noqa: N813

    assert_column_spec(spec, native_type, sqla_type, None, generic_type, is_dttm)


@pytest.mark.parametrize(
    "sql,expected",
    [
        ("SELECT * FROM orders", "SELECT * FROM orders"),
        ("-- top customers\nSELECT * FROM orders", "SELECT * FROM orders"),
        ("/* top customers */ SELECT * FROM orders", "SELECT * FROM orders"),
        (
            "  -- one\n/* two\n   lines */\n-- three\nWITH t AS (SELECT 1) SELECT 2",
            "WITH t AS (SELECT 1) SELECT 2",
        ),
        ("SELECT 1 -- trailing", "SELECT 1 -- trailing"),
        (
            "SELECT '-- not a comment' /* kept */",
            "SELECT '-- not a comment' /* kept */",
        ),
        ("-- only a comment", "-- only a comment"),
    ],
)
def test_execute_drops_leading_comments(
    mocker: MockerFixture,
    sql: str,
    expected: str,
) -> None:
    """
    Test that comments ahead of a statement never reach the driver.

    The DBAPI only reports column names when the statement text starts with
    ``SELECT``, ``PRAGMA`` or ``WITH``, so a leading comment would return rows
    without a cursor description. Comments elsewhere are left alone.
    """
    from superset.db_engine_specs.d1 import CloudflareD1EngineSpec as spec  # noqa: N813

    cursor = mocker.MagicMock()

    spec.execute(cursor, sql, mocker.MagicMock())

    cursor.execute.assert_called_once_with(expected)


@pytest.mark.parametrize(
    "sqlalchemy_uri,error",
    [
        ("d1+httpx://account:token@database", False),
        ("d1+httpx://account:token@database?base_url=https://elsewhere.example", True),
    ],
)
def test_validate_database_uri(sqlalchemy_uri: str, error: bool) -> None:
    """
    Test that ``base_url`` is refused in the URI, because the driver sends the
    API token to the host it names.
    """
    from superset.db_engine_specs.d1 import CloudflareD1EngineSpec as spec  # noqa: N813

    url = make_url(sqlalchemy_uri)
    if error:
        with pytest.raises(ValueError, match="base_url"):
            spec.validate_database_uri(url)
        return
    spec.validate_database_uri(url)


def test_metadata_points_at_sqlalchemy_d1() -> None:
    """
    Test that the docs metadata names ``sqlalchemy-d1`` as the only package and
    installs it through the ``d1`` extra.
    """
    from superset.db_engine_specs.d1 import CloudflareD1EngineSpec

    metadata = CloudflareD1EngineSpec.metadata

    assert metadata["pypi_packages"] == ["sqlalchemy-d1"]
    assert metadata["install_instructions"] == 'pip install "apache-superset[d1]"'
