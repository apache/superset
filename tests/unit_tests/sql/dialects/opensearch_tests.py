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

import pytest
import sqlglot

from superset.sql.dialects.opensearch import OpenSearch


def test_opensearch_dialect_registered() -> None:
    """
    Test that OpenSearch dialect is properly registered for odelasticsearch.
    """
    from superset.sql.parse import SQLGLOT_DIALECTS

    assert "odelasticsearch" in SQLGLOT_DIALECTS
    assert SQLGLOT_DIALECTS["odelasticsearch"] == OpenSearch


def test_double_quotes_as_identifiers() -> None:
    """
    Test that double quotes are treated as identifiers, not string literals.
    """
    sql = 'SELECT "AvgTicketPrice" FROM "flights"'
    ast = sqlglot.parse_one(sql, OpenSearch)

    assert (
        OpenSearch().generate(expression=ast, pretty=True)
        == """
SELECT
  "AvgTicketPrice"
FROM "flights"
        """.strip()
    )


def test_single_quotes_for_strings() -> None:
    """
    Test that single quotes are used for string literals.
    """
    sql = "SELECT * FROM flights WHERE Carrier = 'Kibana Airlines'"
    ast = sqlglot.parse_one(sql, OpenSearch)

    assert (
        OpenSearch().generate(expression=ast, pretty=True)
        == """
SELECT
  *
FROM flights
WHERE
  Carrier = 'Kibana Airlines'
        """.strip()
    )


def test_backticks_as_identifiers() -> None:
    """
    Test that backticks work as identifiers (MySQL-style).
    Backticks are normalized to double quotes in output.
    """
    sql = "SELECT `AvgTicketPrice` FROM `flights`"
    ast = sqlglot.parse_one(sql, OpenSearch)

    assert (
        OpenSearch().generate(expression=ast, pretty=True)
        == """
SELECT
  "AvgTicketPrice"
FROM "flights"
        """.strip()
    )


def test_mixed_identifier_quotes() -> None:
    """
    Test mixing double quotes and backticks for identifiers.
    """
    sql = 'SELECT "AvgTicketPrice" AS `AvgTicketPrice` FROM `default`.`flights`'
    ast = sqlglot.parse_one(sql, OpenSearch)

    assert (
        OpenSearch().generate(expression=ast, pretty=True)
        == """
SELECT
  "AvgTicketPrice" AS "AvgTicketPrice"
FROM "default"."flights"
        """.strip()
    )


@pytest.mark.parametrize(
    "sql, expected",
    [
        (
            'SELECT COUNT(*) FROM "flights" WHERE "Cancelled" = true',
            """
SELECT
  COUNT(*)
FROM "flights"
WHERE
  "Cancelled" = TRUE
            """.strip(),
        ),
        (
            'SELECT "Carrier", SUM("AvgTicketPrice") FROM "flights" GROUP BY "Carrier"',
            """
SELECT
  "Carrier",
  SUM("AvgTicketPrice")
FROM "flights"
GROUP BY
  "Carrier"
            """.strip(),
        ),
        (
            "SELECT * FROM \"flights\" WHERE \"DestCountry\" IN ('US', 'CA', 'MX')",
            """
SELECT
  *
FROM "flights"
WHERE
  "DestCountry" IN ('US', 'CA', 'MX')
            """.strip(),
        ),
    ],
)
def test_various_queries(sql: str, expected: str) -> None:
    """
    Test various SQL queries with OpenSearch dialect.
    """
    ast = sqlglot.parse_one(sql, OpenSearch)
    assert OpenSearch().generate(expression=ast, pretty=True) == expected


def test_aggregate_functions() -> None:
    """
    Test aggregate functions with quoted identifiers.
    """
    sql = """
SELECT
    "Carrier",
    COUNT(*),
    AVG("AvgTicketPrice"),
    MAX("FlightDelayMin")
FROM "flights"
GROUP BY "Carrier"
    """
    ast = sqlglot.parse_one(sql, OpenSearch)

    assert (
        OpenSearch().generate(expression=ast, pretty=True)
        == """
SELECT
  "Carrier",
  COUNT(*),
  AVG("AvgTicketPrice"),
  MAX("FlightDelayMin")
FROM "flights"
GROUP BY
  "Carrier"
        """.strip()
    )


def test_subquery_with_quoted_identifiers() -> None:
    """
    Test subqueries with quoted identifiers.
    """
    sql = 'SELECT * FROM (SELECT "Carrier", "AvgTicketPrice" FROM "flights") AS "sub"'
    ast = sqlglot.parse_one(sql, OpenSearch)

    assert (
        OpenSearch().generate(expression=ast, pretty=True)
        == """
SELECT
  *
FROM (
  SELECT
    "Carrier",
    "AvgTicketPrice"
  FROM "flights"
) AS "sub"
        """.strip()
    )


def test_order_by_with_quoted_identifiers() -> None:
    """
    Test ORDER BY clause with quoted identifiers.
    """
    sql = (
        'SELECT "Carrier", "AvgTicketPrice" FROM "flights" '
        'ORDER BY "AvgTicketPrice" DESC, "Carrier" ASC'
    )
    ast = sqlglot.parse_one(sql, OpenSearch)

    assert (
        OpenSearch().generate(expression=ast, pretty=True)
        == """
SELECT
  "Carrier",
  "AvgTicketPrice"
FROM "flights"
ORDER BY
  "AvgTicketPrice" DESC,
  "Carrier" ASC
        """.strip()
    )


def test_limit_clause() -> None:
    """
    Test LIMIT clause with quoted identifiers.
    """
    sql = 'SELECT * FROM "flights" LIMIT 10'
    ast = sqlglot.parse_one(sql, OpenSearch)

    assert (
        OpenSearch().generate(expression=ast, pretty=True)
        == """
SELECT
  *
FROM "flights"
LIMIT 10
        """.strip()
    )
