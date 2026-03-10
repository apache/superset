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
from unittest.mock import MagicMock

import pytest

from superset.db_engine_specs.dynamodb import DynamoDBEngineSpec
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("text", "'2019-01-02 03:04:05'"),
        ("dateTime", "'2019-01-02 03:04:05'"),
        ("unknowntype", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.dynamodb import (
        DynamoDBEngineSpec as spec,  # noqa: N813
    )

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_allows_sql_comments_is_false() -> None:
    assert DynamoDBEngineSpec.allows_sql_comments is False


@pytest.mark.parametrize(
    "sql,expected",
    [
        # No comments — unchanged
        ("SELECT * FROM t", "SELECT * FROM t"),
        # Single leading -- comment
        ("-- tracking key\nSELECT * FROM t", "SELECT * FROM t"),
        # Multiple leading -- comments
        (
            "-- user: alice\n-- workspace: ws-123\nSELECT * FROM t",
            "SELECT * FROM t",
        ),
        # Block /* */ comment
        ("/* metadata */\nSELECT * FROM t", "SELECT * FROM t"),
        # Mixed -- and /* */ leading comments
        (
            "-- key\n/* block */\n-- another\nSELECT * FROM t",
            "SELECT * FROM t",
        ),
        # Trailing comments preserved
        ("SELECT * FROM t -- inline", "SELECT * FROM t -- inline"),
        # Leading whitespace + comments
        ("  \n-- comment\n  SELECT * FROM t", "SELECT * FROM t"),
        # Empty string
        ("", ""),
        # Only comments
        ("-- just a comment\n-- another", ""),
        # Multi-line block comment
        (
            "/* line1\nline2\nline3 */\nSELECT 1",
            "SELECT 1",
        ),
        # Realistic SQL_QUERY_MUTATOR output with tracking key and metadata
        (
            "-- 6dcd92a04feb50f14bbcf07c661680ba\n"
            'SELECT entityId FROM "sandbox-EntityContextsTable"\n'
            "-- workspace_slug: superset\n"
            "-- 6dcd92a04feb50f14bbcf07c661680ba",
            'SELECT entityId FROM "sandbox-EntityContextsTable"\n'
            "-- workspace_slug: superset\n"
            "-- 6dcd92a04feb50f14bbcf07c661680ba",
        ),
        # Realistic: metadata at top (non-DynamoDB-aware mutator)
        (
            "-- 6dcd92a04feb50f14bbcf07c661680ba\n"
            "-- user: alice@example.com\n"
            "-- workspace_slug: superset\n"
            "SELECT * FROM users\n"
            "-- 6dcd92a04feb50f14bbcf07c661680ba",
            "SELECT * FROM users\n-- 6dcd92a04feb50f14bbcf07c661680ba",
        ),
    ],
)
def test_strip_leading_comments(sql: str, expected: str) -> None:
    assert DynamoDBEngineSpec._strip_leading_comments(sql) == expected


def test_execute_strips_comments() -> None:
    cursor = MagicMock()
    database = MagicMock()
    query = "-- tracking comment\nSELECT * FROM my_table"

    DynamoDBEngineSpec.execute(cursor, query, database)

    cursor.execute.assert_called_once_with("SELECT * FROM my_table")


def test_execute_plain_query() -> None:
    cursor = MagicMock()
    database = MagicMock()
    query = "SELECT * FROM my_table"

    DynamoDBEngineSpec.execute(cursor, query, database)

    cursor.execute.assert_called_once_with("SELECT * FROM my_table")


def test_execute_non_select_queries() -> None:
    cursor = MagicMock()
    database = MagicMock()

    for query_template in [
        "-- comment\nINSERT INTO t VALUES (1, 2)",
        "-- comment\nUPDATE t SET col = 1",
        "-- comment\nDELETE FROM t WHERE id = 1",
    ]:
        cursor.reset_mock()
        DynamoDBEngineSpec.execute(cursor, query_template, database)
        executed = cursor.execute.call_args[0][0]
        assert not executed.startswith("--")
