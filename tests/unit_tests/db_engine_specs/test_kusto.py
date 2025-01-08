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
from datetime import datetime
from typing import Optional

import pytest

from superset.sql.parse import SQLScript
from superset.sql_parse import ParsedQuery
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "sql,expected",
    [
        ("SELECT foo FROM tbl", False),
        ("SHOW TABLES", False),
        ("EXPLAIN SELECT foo FROM tbl", False),
        ("INSERT INTO tbl (foo) VALUES (1)", True),
    ],
)
def test_sql_has_mutation(sql: str, expected: bool) -> None:
    """
    Make sure that SQL dialect consider only SELECT statements as read-only
    """

    from superset.db_engine_specs.kusto import KustoSqlEngineSpec

    assert (
        SQLScript(
            sql,
            engine=KustoSqlEngineSpec.engine,
        ).has_mutation()
        == expected
    )


@pytest.mark.parametrize(
    "kql,expected",
    [
        ("tbl | limit 100", True),
        ("let foo = 1; tbl | where bar == foo", True),
        (".show tables", False),
    ],
)
def test_kql_is_select_query(kql: str, expected: bool) -> None:
    """
    Make sure that KQL dialect consider only statements that do not start with "." (dot)
    as a SELECT statements
    """

    from superset.db_engine_specs.kusto import KustoKqlEngineSpec

    parsed_query = ParsedQuery(kql)
    assert KustoKqlEngineSpec.is_select_query(parsed_query) == expected


@pytest.mark.parametrize(
    "kql,expected",
    [
        ("tbl | limit 100", False),
        ("let foo = 1; tbl | where bar == foo", False),
        (".show tables", False),
        ("print 1", False),
        ("set querytrace; Events | take 100", False),
        (".drop table foo", True),
        (".set-or-append table foo <| bar", True),
    ],
)
def test_kql_has_mutation(kql: str, expected: bool) -> None:
    """
    Make sure that KQL dialect consider only SELECT statements as read-only
    """

    from superset.db_engine_specs.kusto import KustoKqlEngineSpec

    assert (
        SQLScript(
            kql,
            engine=KustoKqlEngineSpec.engine,
        ).has_mutation()
        == expected
    )


def test_kql_parse_sql() -> None:
    """
    parse_sql method should always return a list with a single element
    which is an original query
    """

    from superset.db_engine_specs.kusto import KustoKqlEngineSpec

    queries = KustoKqlEngineSpec.parse_sql("let foo = 1; tbl | where bar == foo")

    assert queries == ["let foo = 1; tbl | where bar == foo"]


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("DateTime", "datetime(2019-01-02T03:04:05.678900)"),
        ("TimeStamp", "datetime(2019-01-02T03:04:05.678900)"),
        ("Date", "datetime(2019-01-02)"),
        ("UnknownType", None),
    ],
)
def test_kql_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.kusto import KustoKqlEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "CONVERT(DATE, '2019-01-02', 23)"),
        ("DateTime", "CONVERT(DATETIME, '2019-01-02T03:04:05.678', 126)"),
        ("SmallDateTime", "CONVERT(SMALLDATETIME, '2019-01-02 03:04:05', 20)"),
        ("TimeStamp", "CONVERT(TIMESTAMP, '2019-01-02 03:04:05', 20)"),
        ("UnknownType", None),
    ],
)
def test_sql_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.kusto import KustoSqlEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)
