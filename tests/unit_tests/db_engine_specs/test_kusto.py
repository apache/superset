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

import pytest
from flask.ctx import AppContext

from tests.unit_tests.fixtures.common import dttm


@pytest.mark.parametrize(
    "sql,expected",
    [
        ("SELECT foo FROM tbl", True),
        ("SHOW TABLES", False),
        ("EXPLAIN SELECT foo FROM tbl", False),
        ("INSERT INTO tbl (foo) VALUES (1)", False),
    ],
)
def test_sql_is_readonly_query(
    app_context: AppContext, sql: str, expected: bool
) -> None:
    """
    Make sure that SQL dialect consider only SELECT statements as read-only
    """

    from superset.db_engine_specs.kusto import KustoSqlEngineSpec
    from superset.sql_parse import ParsedQuery

    parsed_query = ParsedQuery(sql)
    is_readonly = KustoSqlEngineSpec.is_readonly_query(parsed_query)

    assert expected == is_readonly


@pytest.mark.parametrize(
    "kql,expected",
    [
        ("tbl | limit 100", True),
        ("let foo = 1; tbl | where bar == foo", True),
        (".show tables", False),
    ],
)
def test_kql_is_select_query(app_context: AppContext, kql: str, expected: bool) -> None:
    """
    Make sure that KQL dialect consider only statements that do not start with "." (dot)
    as a SELECT statements
    """

    from superset.db_engine_specs.kusto import KustoKqlEngineSpec
    from superset.sql_parse import ParsedQuery

    parsed_query = ParsedQuery(kql)
    is_select = KustoKqlEngineSpec.is_select_query(parsed_query)

    assert expected == is_select


@pytest.mark.parametrize(
    "kql,expected",
    [
        ("tbl | limit 100", True),
        ("let foo = 1; tbl | where bar == foo", True),
        (".show tables", True),
        ("print 1", True),
        ("set querytrace; Events | take 100", True),
        (".drop table foo", False),
        (".set-or-append table foo <| bar", False),
    ],
)
def test_kql_is_readonly_query(
    app_context: AppContext, kql: str, expected: bool
) -> None:
    """
    Make sure that KQL dialect consider only SELECT statements as read-only
    """

    from superset.db_engine_specs.kusto import KustoKqlEngineSpec
    from superset.sql_parse import ParsedQuery

    parsed_query = ParsedQuery(kql)
    is_readonly = KustoKqlEngineSpec.is_readonly_query(parsed_query)

    assert expected == is_readonly


def test_kql_parse_sql(app_context: AppContext) -> None:
    """
    parse_sql method should always return a list with a single element
    which is an original query
    """

    from superset.db_engine_specs.kusto import KustoKqlEngineSpec

    queries = KustoKqlEngineSpec.parse_sql("let foo = 1; tbl | where bar == foo")

    assert queries == ["let foo = 1; tbl | where bar == foo"]


@pytest.mark.parametrize(
    "target_type,expected_dttm",
    [
        ("DATETIME", "datetime(2019-01-02T03:04:05.678900)"),
        ("TIMESTAMP", "datetime(2019-01-02T03:04:05.678900)"),
        ("DATE", "datetime(2019-01-02)"),
    ],
)
def test_kql_convert_dttm(
    app_context: AppContext, target_type: str, expected_dttm: str, dttm: datetime,
) -> None:
    """
    Test that date objects are converted correctly.
    """

    from superset.db_engine_specs.kusto import KustoKqlEngineSpec

    assert expected_dttm == KustoKqlEngineSpec.convert_dttm(target_type, dttm)


@pytest.mark.parametrize(
    "target_type,expected_dttm",
    [
        ("DATETIME", "CONVERT(DATETIME, '2019-01-02T03:04:05.678', 126)"),
        ("DATE", "CONVERT(DATE, '2019-01-02', 23)"),
        ("SMALLDATETIME", "CONVERT(SMALLDATETIME, '2019-01-02 03:04:05', 20)"),
        ("TIMESTAMP", "CONVERT(TIMESTAMP, '2019-01-02 03:04:05', 20)"),
    ],
)
def test_sql_convert_dttm(
    app_context: AppContext, target_type: str, expected_dttm: str, dttm: datetime,
) -> None:
    """
    Test that date objects are converted correctly.
    """

    from superset.db_engine_specs.kusto import KustoSqlEngineSpec

    assert expected_dttm == KustoSqlEngineSpec.convert_dttm(target_type, dttm)
