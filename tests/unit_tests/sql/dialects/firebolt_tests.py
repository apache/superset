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

from superset.sql.dialects.firebolt import Firebolt, FireboltOld


def test_not_sql() -> None:  # pylint: disable=invalid-name
    """
    Test the `not_sql` method in the generator.
    """
    # use generic parser, since the Firebolt dialect will parenthesize
    ast = sqlglot.parse_one("SELECT * FROM t WHERE NOT col IN (1, 2)")

    # make sure generated SQL is parenthesized
    assert (
        Firebolt().generate(expression=ast, pretty=True)
        == """
SELECT
  *
FROM t
WHERE
  NOT (col IN (1, 2))
            """.strip()
    )


@pytest.mark.parametrize(
    "sql, expected",
    [
        (
            "SELECT price, quantity, price * quantity AS sales_amount FROM Sales",
            """
SELECT
  price,
  quantity,
  price * quantity AS sales_amount
FROM Sales
            """.strip(),
        ),
        (
            "SELECT ALL * FROM Sales",
            """
SELECT
  *
FROM Sales
            """.strip(),
        ),
        (
            "SELECT DISTINCT product FROM Sales",
            """
SELECT DISTINCT
  product
FROM Sales
            """.strip(),
        ),
        (
            "SELECT * FROM Sales, Products",
            """
SELECT
  *
FROM Sales, Products
            """.strip(),
        ),
    ],
)
def test_select_from(sql: str, expected: str) -> None:
    """
    Test the `SELECT` statement in the old dialect.
    """
    ast = sqlglot.parse_one(sql, FireboltOld)
    assert FireboltOld().generate(expression=ast, pretty=True) == expected


def test_unnest() -> None:
    """
    Test the `UNNEST` in the old dialect.
    """
    ast = sqlglot.parse_one(
        """
SELECT
  id,
  tags
FROM visits
  UNNEST(tags);
        """,
        FireboltOld,
    )

    assert (
        FireboltOld().generate(expression=ast, pretty=True)
        == """
SELECT
  id,
  tags
FROM visits UNNEST(tags)
        """.strip()
    )


def test_unnest_with_array() -> None:
    """
    Test the `UNNEST` in the old dialect with array columns.
    """
    ast = sqlglot.parse_one(
        """
SELECT
    id,
    a_keys,
    a_vals
FROM
    visits
    UNNEST(agent_props_keys as a_keys,
           agent_props_vals as a_vals)

        """,
        FireboltOld,
    )

    assert (
        FireboltOld().generate(expression=ast, pretty=True)
        == """
SELECT
  id,
  a_keys,
  a_vals
FROM visits UNNEST(agent_props_keys AS a_keys, agent_props_vals AS a_vals)
        """.strip()
    )


def test_unnest_multiple() -> None:
    """
    Test multiple `UNNEST` in the old dialect.
    """
    ast = sqlglot.parse_one(
        """
SELECT
    id,
    a_keys,
    a_vals
FROM
    visits
UNNEST(agent_props_keys as a_keys)
UNNEST(agent_props_vals as a_vals)
        """,
        FireboltOld,
    )

    assert (
        FireboltOld().generate(expression=ast, pretty=True)
        == """
SELECT
  id,
  a_keys,
  a_vals
FROM visits UNNEST(agent_props_keys AS a_keys) UNNEST(agent_props_vals AS a_vals)
        """.strip()
    )


def test_unnest_translating() -> None:
    """
    Test translating the `UNNEST` from the old to the new dialect.
    """
    ast = sqlglot.parse_one(
        """
SELECT
  id,
  tags
FROM visits
  UNNEST(tags);
        """,
        FireboltOld,
    )

    assert (
        Firebolt().generate(expression=ast, pretty=True)
        == """
SELECT
  id,
  tags
FROM visits, UNNEST(tags)
        """.strip()
    )


def test_join_on() -> None:
    """
    Test the `JOIN ... ON` syntax in the Firebolt dialect.
    """
    ast = sqlglot.parse_one(
        """
SELECT
    *
FROM
    t1
JOIN
    t2
ON t1.foo = t2.id;
        """,
        FireboltOld,
    )

    assert (
        FireboltOld().generate(expression=ast, pretty=True)
        == """
SELECT
  *
FROM t1
JOIN t2
  ON t1.foo = t2.id
        """.strip()
    )


def test_join_using() -> None:
    """
    Test the `JOIN ... USING` syntax in the Firebolt dialect.
    """
    ast = sqlglot.parse_one(
        """
SELECT
    *
FROM
    t1
JOIN
    t2 USING (id, age);
        """,
        FireboltOld,
    )

    assert (
        FireboltOld().generate(expression=ast, pretty=True)
        == """
SELECT
  *
FROM t1
JOIN t2
  USING (id, age)
        """.strip()
    )


def test_cte() -> None:
    """
    Test the `WITH` clause in the Firebolt dialect.
    """
    ast = sqlglot.parse_one(
        """
WITH nl_subscribers AS (
    SELECT
        *
    FROM
        players
    WHERE
        issubscribedtonewsletter=TRUE
)
SELECT
    nickname,
    email
FROM
    players
ORDER BY
    nickname
        """,
        FireboltOld,
    )

    assert (
        FireboltOld().generate(expression=ast, pretty=True)
        == """
WITH nl_subscribers AS (
  SELECT
    *
  FROM players
  WHERE
    issubscribedtonewsletter = TRUE
)
SELECT
  nickname,
  email
FROM players
ORDER BY
  nickname
        """.strip()
    )


@pytest.mark.parametrize(
    "sql, expected",
    [
        (
            """
SELECT
    *
FROM
    num_test
INNER JOIN
    num_test2
    USING (
        firstname,
        score
	);
            """,
            """
SELECT
  *
FROM num_test
INNER JOIN num_test2
  USING (firstname, score)
            """.strip(),
        ),
        (
            """
SELECT
    *
FROM
    num_test
INNER JOIN
    num_test2
        ON num_test.firstname = num_test2.firstname
        AND num_test.score = num_test2.score;
            """,
            """
SELECT
  *
FROM num_test
INNER JOIN num_test2
  ON num_test.firstname = num_test2.firstname AND num_test.score = num_test2.score
            """.strip(),
        ),
        (
            """
SELECT
    num_test.firstname,
    num_test2.firstname
FROM num_test
LEFT OUTER JOIN
    num_test2
    USING (firstname);
            """,
            """
SELECT
  num_test.firstname,
  num_test2.firstname
FROM num_test
LEFT OUTER JOIN num_test2
  USING (firstname)
            """.strip(),
        ),
        (
            """
SELECT
    num_test.firstname,
    num_test2.firstname
FROM
    num_test
RIGHT OUTER JOIN
    num_test2
    USING (firstname);
            """,
            """
SELECT
  num_test.firstname,
  num_test2.firstname
FROM num_test
RIGHT OUTER JOIN num_test2
  USING (firstname)
            """.strip(),
        ),
        (
            """
SELECT
    num_test.firstname,
    num_test2.firstname
FROM
    num_test
FULL OUTER JOIN
    num_test2
    USING (firstname);
            """,
            """
SELECT
  num_test.firstname,
  num_test2.firstname
FROM num_test
FULL OUTER JOIN num_test2
  USING (firstname)
            """.strip(),
        ),
        (
            """
SELECT
    crossjoin_test.letter,
    crossjoin_test2.letter
FROM
    crossjoin_test
CROSS JOIN
    crossjoin_test2;
            """,
            """
SELECT
  crossjoin_test.letter,
  crossjoin_test2.letter
FROM crossjoin_test
CROSS JOIN crossjoin_test2
            """.strip(),
        ),
    ],
)
def test_join(sql: str, expected: str) -> None:
    """
    Test different joins in the old dialect.
    """
    ast = sqlglot.parse_one(sql, FireboltOld)
    assert FireboltOld().generate(expression=ast, pretty=True) == expected
