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

from superset.sql.dialects.pinot import Pinot


def test_double_quotes_as_identifiers() -> None:
    """
    Test that double quotes are treated as identifiers, not string literals.
    """
    sql = 'SELECT "column_name" FROM "table_name"'
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  "column_name"
FROM "table_name"
        """.strip()
    )


def test_single_quotes_for_strings() -> None:
    """
    Test that single quotes are used for string literals.
    """
    sql = "SELECT * FROM users WHERE name = 'John'"
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  *
FROM users
WHERE
  name = 'John'
        """.strip()
    )


def test_backticks_as_identifiers() -> None:
    """
    Test that backticks work as identifiers (MySQL-style).
    Backticks are normalized to double quotes in output.
    """
    sql = "SELECT `column_name` FROM `table_name`"
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  "column_name"
FROM "table_name"
        """.strip()
    )


def test_mixed_identifier_quotes() -> None:
    """
    Test mixing double quotes and backticks for identifiers.
    All identifiers are normalized to double quotes in output.
    """
    sql = (
        'SELECT "col1", `col2` FROM "table1" JOIN `table2` ON "table1".id = `table2`.id'
    )
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  "col1",
  "col2"
FROM "table1"
JOIN "table2"
  ON "table1".id = "table2".id
        """.strip()
    )


def test_string_with_escaped_quotes() -> None:
    """
    Test string literals with escaped single quotes.
    """
    sql = "SELECT * FROM users WHERE name = 'O''Brien'"
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  *
FROM users
WHERE
  name = 'O''Brien'
        """.strip()
    )


def test_string_with_backslash_escape() -> None:
    """
    Test string literals with backslash escapes.
    """
    sql = r"SELECT * FROM users WHERE path = 'C:\\Users\\John'"
    ast = sqlglot.parse_one(sql, Pinot)

    generated = Pinot().generate(expression=ast, pretty=True)
    assert "WHERE" in generated
    assert "path" in generated


@pytest.mark.parametrize(
    "sql, expected",
    [
        (
            'SELECT COUNT(*) FROM "events" WHERE "type" = \'click\'',
            """
SELECT
  COUNT(*)
FROM "events"
WHERE
  "type" = 'click'
            """.strip(),
        ),
        (
            'SELECT "user_id", SUM("amount") FROM "transactions" GROUP BY "user_id"',
            """
SELECT
  "user_id",
  SUM("amount")
FROM "transactions"
GROUP BY
  "user_id"
            """.strip(),
        ),
        (
            "SELECT * FROM \"orders\" WHERE \"status\" IN ('pending', 'shipped')",
            """
SELECT
  *
FROM "orders"
WHERE
  "status" IN ('pending', 'shipped')
            """.strip(),
        ),
    ],
)
def test_various_queries(sql: str, expected: str) -> None:
    """
    Test various SQL queries with Pinot dialect.
    """
    ast = sqlglot.parse_one(sql, Pinot)
    assert Pinot().generate(expression=ast, pretty=True) == expected


def test_aggregate_functions() -> None:
    """
    Test aggregate functions with quoted identifiers.
    """
    sql = """
SELECT
    "category",
    COUNT(*),
    AVG("price"),
    MAX("quantity")
FROM "products"
GROUP BY "category"
    """
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  "category",
  COUNT(*),
  AVG("price"),
  MAX("quantity")
FROM "products"
GROUP BY
  "category"
        """.strip()
    )


def test_join_with_quoted_identifiers() -> None:
    """
    Test JOIN operations with double-quoted identifiers.
    """
    sql = """
    SELECT "u"."name", "o"."total"
    FROM "users" AS "u"
    JOIN "orders" AS "o" ON "u"."id" = "o"."user_id"
    """
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  "u"."name",
  "o"."total"
FROM "users" AS "u"
JOIN "orders" AS "o"
  ON "u"."id" = "o"."user_id"
        """.strip()
    )


def test_subquery_with_quoted_identifiers() -> None:
    """
    Test subqueries with double-quoted identifiers.
    """
    sql = 'SELECT * FROM (SELECT "id", "name" FROM "users") AS "subquery"'
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  *
FROM (
  SELECT
    "id",
    "name"
  FROM "users"
) AS "subquery"
        """.strip()
    )


def test_case_expression() -> None:
    """
    Test CASE expressions with quoted identifiers.
    """
    sql = """
    SELECT "name",
           CASE WHEN "age" < 18 THEN 'minor'
                WHEN "age" >= 18 THEN 'adult'
           END AS "category"
    FROM "persons"
    """
    ast = sqlglot.parse_one(sql, Pinot)

    generated = Pinot().generate(expression=ast, pretty=True)
    assert '"name"' in generated
    assert '"age"' in generated
    assert '"category"' in generated
    assert "'minor'" in generated
    assert "'adult'" in generated


def test_cte_with_quoted_identifiers() -> None:
    """
    Test Common Table Expressions (CTE) with quoted identifiers.
    """
    sql = """
    WITH "high_value_orders" AS (
        SELECT * FROM "orders" WHERE "total" > 1000
    )
    SELECT "customer_id", COUNT(*) FROM "high_value_orders" GROUP BY "customer_id"
    """
    ast = sqlglot.parse_one(sql, Pinot)

    generated = Pinot().generate(expression=ast, pretty=True)
    assert 'WITH "high_value_orders" AS' in generated
    assert '"orders"' in generated
    assert '"total"' in generated
    assert '"customer_id"' in generated


def test_order_by_with_quoted_identifiers() -> None:
    """
    Test ORDER BY clause with quoted identifiers.
    SQLGlot explicitly includes ASC in the output.
    """
    sql = 'SELECT "name", "salary" FROM "employees" ORDER BY "salary" DESC, "name" ASC'
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT
  "name",
  "salary"
FROM "employees"
ORDER BY
  "salary" DESC,
  "name" ASC
        """.strip()
    )


def test_limit_and_offset() -> None:
    """
    Test LIMIT and OFFSET clauses.
    """
    sql = 'SELECT * FROM "products" LIMIT 10 OFFSET 20'
    ast = sqlglot.parse_one(sql, Pinot)

    generated = Pinot().generate(expression=ast, pretty=True)
    assert '"products"' in generated
    assert "LIMIT 10" in generated


def test_distinct() -> None:
    """
    Test DISTINCT keyword with quoted identifiers.
    """
    sql = 'SELECT DISTINCT "category" FROM "products"'
    ast = sqlglot.parse_one(sql, Pinot)

    assert (
        Pinot().generate(expression=ast, pretty=True)
        == """
SELECT DISTINCT
  "category"
FROM "products"
        """.strip()
    )
