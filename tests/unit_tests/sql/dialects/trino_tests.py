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

from superset.exceptions import SupersetParseError
from superset.sql.dialects.trino import InlineUDF, Trino
from superset.sql.parse import SQLScript, SQLStatement, Table

# example from https://trino.io/docs/current/udf/sql/begin.html, reported in
# https://github.com/apache/superset/issues/26162
INLINE_UDF = """
WITH FUNCTION meaning_of_life()
  RETURNS tinyint
  BEGIN
    DECLARE a tinyint DEFAULT CAST(6 AS tinyint);
    DECLARE b tinyint DEFAULT CAST(7 AS tinyint);
    RETURN a * b;
  END
SELECT meaning_of_life()
""".strip()


def test_inline_udf_is_single_statement() -> None:
    """
    Semicolons inside the routine body must not split the statement.
    """
    statements = sqlglot.parse(INLINE_UDF, dialect=Trino)
    assert len(statements) == 1
    assert len(list(statements[0].find_all(InlineUDF))) == 1


def test_inline_udf_generates_verbatim() -> None:
    """
    The function specification should be preserved verbatim, and the
    generated SQL should be parseable again.
    """
    statement = sqlglot.parse_one(INLINE_UDF, dialect=Trino)
    generated = statement.sql(dialect=Trino)
    assert (
        """
WITH FUNCTION meaning_of_life()
  RETURNS tinyint
  BEGIN
    DECLARE a tinyint DEFAULT CAST(6 AS tinyint);
    DECLARE b tinyint DEFAULT CAST(7 AS tinyint);
    RETURN a * b;
  END
""".strip()
        in generated
    )
    assert sqlglot.parse_one(generated, dialect=Trino)


def test_inline_udf_return_form() -> None:
    """
    Test functions whose body is a single ``RETURN`` expression, including
    multiple comma-separated functions in one ``WITH`` clause.
    """
    sql = """
WITH
  FUNCTION hello(name varchar)
    RETURNS varchar
    RETURN format('Hello %s!', name),
  FUNCTION bye()
    RETURNS varchar
    RETURN 'Bye!'
SELECT hello('Finn') || ' and ' || bye()
    """.strip()
    statement = sqlglot.parse_one(sql, dialect=Trino)
    assert len(list(statement.find_all(InlineUDF))) == 2

    generated = statement.sql(dialect=Trino)
    assert "RETURN format('Hello %s!', name)" in generated
    assert "RETURN 'Bye!'" in generated


@pytest.mark.parametrize(
    "sql",
    [
        """
WITH FUNCTION classify(a bigint)
  RETURNS varchar
  BEGIN
    CASE a
      WHEN 0 THEN RETURN 'zero';
      WHEN 1 THEN RETURN 'one';
      ELSE RETURN 'more than one or negative';
    END CASE;
    RETURN NULL;
  END
SELECT classify(x) FROM some_table
        """,
        """
WITH FUNCTION classify(a bigint)
  RETURNS varchar
  BEGIN
    IF a > 100 THEN
      RETURN 'big';
    ELSEIF a > 0 THEN
      RETURN 'small';
    END IF;
    RETURN 'negative';
  END
SELECT classify(x) FROM some_table
        """,
        """
WITH FUNCTION classify(a bigint)
  RETURNS varchar
  BEGIN
    WHILE a < 100 DO
      SET a = a + 1;
    END WHILE;
    RETURN IF(a = 100, 'hundred', 'other');
  END
SELECT classify(x) FROM some_table
        """,
    ],
)
def test_inline_udf_nested_blocks(sql: str) -> None:
    """
    Test nested blocks: ``CASE ... END CASE``, ``IF ... END IF``,
    ``WHILE ... END WHILE``, and scalar ``IF()`` function calls.
    """
    statements = sqlglot.parse(sql.strip(), dialect=Trino)
    assert len(statements) == 1


def test_cte_named_function_still_works() -> None:
    """
    A CTE named "function" must still be parsed as a regular CTE.
    """
    sql = "WITH function AS (SELECT 1 AS x) SELECT x FROM function"
    statement = sqlglot.parse_one(sql, dialect=Trino)
    assert not list(statement.find_all(InlineUDF))
    assert statement.sql(dialect=Trino) == sql


def test_unbalanced_body_raises() -> None:
    """
    An unterminated routine body should raise a parse error.
    """
    sql = "WITH FUNCTION f() RETURNS int BEGIN RETURN 1; SELECT f()"
    with pytest.raises(sqlglot.errors.ParseError):
        sqlglot.parse(sql, dialect=Trino)


def test_missing_body_raises() -> None:
    """
    A function specification without a body should raise a parse error.
    """
    sql = "WITH FUNCTION f() RETURNS int SELECT f()"
    with pytest.raises(sqlglot.errors.ParseError):
        sqlglot.parse(sql, dialect=Trino)


def test_missing_return_expression_raises() -> None:
    """
    A ``RETURN`` body without a following expression should raise a parse
    error.
    """
    sql = "WITH FUNCTION f() RETURNS int RETURN"
    with pytest.raises(sqlglot.errors.ParseError):
        sqlglot.parse(sql, dialect=Trino)


def test_semicolon_with_trailing_comment() -> None:
    """
    A statement-separating semicolon with a comment attached to it (no
    whitespace in between) should still split statements correctly.
    """
    sql = "SELECT 1;-- trailing\nSELECT 2"
    statements = sqlglot.parse(sql, dialect=Trino)
    assert len(statements) == 3  # SELECT 1, the comment-bearing `;`, SELECT 2


def test_trailing_semicolon_with_no_following_statement() -> None:
    """
    A single statement terminated by a semicolon with nothing after it
    should parse as one statement.
    """
    statements = sqlglot.parse("SELECT 1;", dialect=Trino)
    assert len(statements) == 1


def test_sqlscript_inline_udf() -> None:
    """
    Integration with the Superset parsing API (reproduces #26162).
    """
    script = SQLScript(INLINE_UDF, "trino")
    assert len(script.statements) == 1
    assert not script.has_mutation()

    statement = script.statements[0]
    assert statement.is_select()
    assert statement.format() == statement.format()  # deterministic


def test_sqlscript_inline_udf_multiple_statements() -> None:
    """
    Statements after the UDF query should still be split correctly.
    """
    script = SQLScript(f"{INLINE_UDF};\nSELECT 42", "trino")
    assert len(script.statements) == 2


def test_sqlstatement_extract_tables() -> None:
    """
    Tables referenced by the main query should still be extracted.
    """
    sql = """
WITH FUNCTION doubleup(x integer)
  RETURNS integer
  BEGIN
    RETURN x * 2;
  END
SELECT doubleup(some_column) FROM some_table
    """.strip()
    statement = SQLStatement(sql, "trino")
    assert statement.tables == {Table("some_table")}


def test_sqlstatement_regular_queries_unaffected() -> None:
    """
    Regular Trino queries should parse exactly as before.
    """
    script = SQLScript(
        "WITH t AS (SELECT 1 AS x) SELECT * FROM t; SELECT 2",
        "trino",
    )
    assert len(script.statements) == 2
    assert script.statements[0].tables == set()

    with pytest.raises(SupersetParseError):
        SQLStatement("SELECT * FROM", "trino")


def test_create_function_not_split() -> None:
    """
    ``CREATE FUNCTION`` bodies should not be split on semicolons either.
    """
    sql = """
CREATE FUNCTION meaning_of_life()
  RETURNS tinyint
  BEGIN
    DECLARE a tinyint DEFAULT CAST(6 AS tinyint);
    DECLARE b tinyint DEFAULT CAST(7 AS tinyint);
    RETURN a * b;
  END;
SELECT 42
    """.strip()
    statements = sqlglot.parse(sql, dialect=Trino)
    assert len(statements) == 2
