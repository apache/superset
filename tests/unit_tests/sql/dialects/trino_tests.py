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

import hashlib
import inspect

import pytest
import sqlglot
from sqlglot.parser import Parser as SqlglotParser

from superset.exceptions import SupersetParseError
from superset.sql.dialects.trino import InlineUDF, Trino
from superset.sql.parse import SQLScript, SQLStatement, Table

# Hash of ``sqlglot.parser.Parser._parse``'s source, verified against
# sqlglot 30.16.0 (the version pinned in ``requirements/base.txt``) when
# ``Trino.Parser._parse`` was copied from it. ``Trino.Parser._parse`` is a
# hand-maintained copy rather than an extension through a public hook (see
# its own docstring), so it silently drifts if sqlglot changes this method.
# This test is a tripwire: a hash mismatch means sqlglot's ``_parse`` moved
# out from under the copy, and ``Trino.Parser._parse`` needs a re-diff (and
# this hash needs updating) before the next sqlglot bump.
_UPSTREAM_PARSE_SOURCE_SHA256 = (
    "674878e8b6c33a06cffe58c3565dba54e6e3c82c2ad8a5449ac790698f2bd519"
)

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
        """
WITH FUNCTION classify(a bigint)
  RETURNS varchar
  BEGIN
    IF (a > 100) THEN
      RETURN 'big';
    ELSEIF a > 0 THEN
      RETURN 'small';
    END IF;
    RETURN 'negative';
  END
SELECT classify(x) FROM some_table
        """,
    ],
)
def test_inline_udf_nested_blocks(sql: str) -> None:
    """
    Test nested blocks: ``CASE ... END CASE``, ``IF ... END IF``,
    ``WHILE ... END WHILE``, scalar ``IF()`` function calls, and a
    parenthesized ``IF (...) THEN`` condition.
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


def test_inline_udf_after_regular_cte() -> None:
    """
    An inline UDF following a regular CTE in the same ``WITH`` clause must
    still have its body's semicolons kept intact.
    """
    sql = """
WITH cte AS (SELECT 1),
FUNCTION meaning_of_life()
  RETURNS tinyint
  BEGIN
    DECLARE a tinyint DEFAULT CAST(6 AS tinyint);
    DECLARE b tinyint DEFAULT CAST(7 AS tinyint);
    RETURN a * b;
  END
SELECT meaning_of_life()
""".strip()
    statements = sqlglot.parse(sql, dialect=Trino)
    assert len(statements) == 1
    assert len(list(statements[0].find_all(InlineUDF))) == 1


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


def test_inline_udf_nested_parens_in_condition() -> None:
    """
    A parenthesized ``IF`` condition containing its own nested parens must
    still be recognized as a block opener, not a scalar function call.
    """
    sql = """
WITH FUNCTION classify(a bigint, b bigint)
  RETURNS varchar
  BEGIN
    IF ((a > 100) AND (b > 100)) THEN
      RETURN 'big';
    END IF;
    RETURN 'small';
  END
SELECT classify(x, y) FROM some_table
    """.strip()
    statements = sqlglot.parse(sql, dialect=Trino)
    assert len(statements) == 1
    assert len(list(statements[0].find_all(InlineUDF))) == 1


def test_scalar_function_named_function() -> None:
    """
    A regular scalar function call literally named ``function`` (outside a
    ``CREATE``/``WITH`` routine specification) must parse normally.
    """
    sql = "SELECT function(x) FROM t"
    statements = sqlglot.parse(sql, dialect=Trino)
    assert len(statements) == 1


def test_unclosed_if_condition_raises() -> None:
    """
    An ``IF`` condition with an unbalanced opening paren should fail to
    parse rather than being silently misread as a block.
    """
    sql = (
        "WITH FUNCTION f() RETURNS int BEGIN "
        "IF (a > 1 THEN RETURN 1; END IF; RETURN 2; END SELECT 1"
    )
    with pytest.raises(sqlglot.errors.ParseError):
        sqlglot.parse(sql, dialect=Trino)


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


def test_create_or_replace_function_not_split() -> None:
    """
    ``CREATE OR REPLACE FUNCTION`` bodies should not be split on semicolons
    either, and the routine is followed by the next statement.
    """
    sql = """
CREATE OR REPLACE FUNCTION meaning_of_life()
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


def test_block_keyword_as_parameter_reference_not_counted() -> None:
    """
    ``LOOP``, ``REPEAT``, and ``WHILE`` are not reserved words in Trino, so
    an unquoted routine parameter or column reference spelled the same way
    (e.g. a parameter named ``loop``) must not be mistaken for a
    block-opening keyword, which would otherwise leave the block depth
    unbalanced at ``END``.
    """
    sql = """
WITH FUNCTION echo(loop bigint)
  RETURNS bigint
  BEGIN
    RETURN loop;
  END
SELECT echo(x) FROM some_table
    """.strip()
    statements = sqlglot.parse(sql, dialect=Trino)
    assert len(statements) == 1
    assert len(list(statements[0].find_all(InlineUDF))) == 1


def test_body_keyword_in_routine_characteristic_ignored() -> None:
    """
    A routine characteristic string value that happens to spell a body
    keyword (e.g. ``COMMENT 'RETURN'`` or ``COMMENT 'BEGIN'``) must not be
    mistaken for the actual start of the function body.
    """
    sql = """
WITH FUNCTION f()
  RETURNS int
  COMMENT 'RETURN'
  BEGIN
    RETURN 1;
  END
SELECT f()
    """.strip()
    statements = sqlglot.parse(sql, dialect=Trino)
    assert len(statements) == 1
    assert len(list(statements[0].find_all(InlineUDF))) == 1

    sql_begin_comment = """
WITH FUNCTION f()
  RETURNS int
  COMMENT 'BEGIN'
  RETURN 1
SELECT f()
    """.strip()
    statements = sqlglot.parse(sql_begin_comment, dialect=Trino)
    assert len(statements) == 1
    assert len(list(statements[0].find_all(InlineUDF))) == 1


def test_block_keywords_in_string_literals_and_identifiers_ignored() -> None:
    """
    Block keywords (``BEGIN``, ``CASE``, ``END``, ``IF``, ...) that appear as
    the text of a string literal or a quoted identifier must not be mistaken
    for actual routine keywords when tracking block depth, since they carry
    the same text but a different token type.
    """
    sql = """
WITH FUNCTION describe_status(status varchar)
  RETURNS varchar
  BEGIN
    IF status = 'END' THEN
      RETURN 'terminal';
    END IF;
    RETURN "case";
  END
SELECT describe_status('END')
    """.strip()
    statements = sqlglot.parse(sql, dialect=Trino)
    assert len(statements) == 1
    assert len(list(statements[0].find_all(InlineUDF))) == 1


def test_cte_named_function_does_not_trigger_routine_mode() -> None:
    """
    An ordinary CTE named "function" must not put the parser into routine
    mode: block keywords used as ordinary identifiers/expressions elsewhere
    in the script (here, `loop` as a column alias, and the `CASE ... END`
    expression) must not affect statement splitting, and a later statement
    must still be split off correctly.
    """
    sql = (
        "WITH function AS (SELECT 1 AS a, 2 AS loop) "
        "SELECT CASE WHEN a THEN loop ELSE 0 END FROM function; "
        "SELECT 2"
    )
    statements = sqlglot.parse(sql, dialect=Trino)
    assert len(statements) == 2
    assert not list(statements[0].find_all(InlineUDF))


def test_labeled_loop_block_depth_tracked() -> None:
    """
    A labeled loop (``label: WHILE ... END WHILE``, per
    https://trino.io/docs/current/udf/sql.html) must still be tracked for
    block depth: the label's trailing ``:`` sits between the loop opener and
    its preceding statement separator/branch keyword.
    """
    sql = """
WITH FUNCTION count_to(n bigint)
  RETURNS bigint
  BEGIN
    DECLARE r bigint DEFAULT 0;
    top: WHILE r < n DO
      SET r = r + 1;
    END WHILE;
    RETURN r;
  END
SELECT count_to(5)
    """.strip()
    statements = sqlglot.parse(sql, dialect=Trino)
    assert len(statements) == 1
    assert len(list(statements[0].find_all(InlineUDF))) == 1


def test_udf_body_function_calls_visible_to_check_functions_present() -> None:
    """
    A scalar function call inside an inline UDF body must still be visible
    to ``SQLScript.check_functions_present`` (used to enforce
    ``DISALLOWED_SQL_FUNCTIONS``), even though the body itself is stored as
    opaque, verbatim text.
    """
    sql = """
WITH FUNCTION mask(x varchar)
  RETURNS varchar
  RETURN regexp_replace(x, '.', '*')
SELECT mask(some_column) FROM some_table
    """.strip()
    script = SQLScript(sql, "trino")
    assert script.statements[0].check_functions_present({"regexp_replace"})
    assert not script.statements[0].check_functions_present({"not_present"})


def test_udf_body_reserved_word_function_call_visible_to_check_functions_present() -> (
    None
):
    """
    A handful of scalar functions (``current_user``, ``localtime``, etc.) are
    reserved words with their own dedicated token type rather than the
    generic ``VAR`` most function names get, so they must still be caught
    when called with parentheses inside an inline UDF body.
    """
    sql = """
WITH FUNCTION whoami()
  RETURNS varchar
  RETURN current_user()
SELECT whoami()
    """.strip()
    script = SQLScript(sql, "trino")
    assert script.statements[0].check_functions_present({"current_user"})


def test_udf_body_bare_no_paren_function_call_visible_to_check_functions_present() -> (
    None
):
    """
    Trino also permits calling a handful of scalar functions with no
    parentheses at all, e.g. plain ``current_user`` rather than
    ``current_user()``. That bare form must still be caught, since it
    otherwise would not have looked like a call at all (nothing follows it).
    """
    sql = """
WITH FUNCTION whoami()
  RETURNS varchar
  RETURN current_user
SELECT whoami()
    """.strip()
    script = SQLScript(sql, "trino")
    assert script.statements[0].check_functions_present({"current_user"})


def test_upstream_parse_source_is_unchanged() -> None:
    """
    ``Trino.Parser._parse`` is a hand-maintained copy of
    ``sqlglot.parser.Parser._parse``, not an extension through a public
    hook (see its own docstring). If sqlglot ever changes that method, this
    copy silently drifts out of sync instead of failing loudly, so this
    hashes the upstream source and compares it against the version this
    copy was last verified against.

    A failure here does not mean anything is broken; it means
    ``Trino.Parser._parse`` needs a re-diff against the new sqlglot source,
    and this hash needs updating once that's done.
    """
    upstream_source = inspect.getsource(SqlglotParser._parse)
    upstream_hash = hashlib.sha256(upstream_source.encode()).hexdigest()
    assert upstream_hash == _UPSTREAM_PARSE_SOURCE_SHA256, (
        "sqlglot.parser.Parser._parse has changed since Trino.Parser._parse "
        "was copied from it. Re-diff superset/sql/dialects/trino.py's "
        "_parse against the new sqlglot source, update its docstring, and "
        "update _UPSTREAM_PARSE_SOURCE_SHA256 above to match."
    )


@pytest.mark.xfail(
    reason=(
        "known limitation: a bare `if`/`loop`/`while`/`repeat` identifier "
        "right after THEN in a scalar CASE expression is misread as a "
        "procedural block opener, since THEN also opens a nested statement "
        "in a procedural IF/CASE statement and both share the same tokens; "
        "see _STATEMENT_START_PREV_TEXTS"
    ),
    strict=True,
)
def test_udf_body_case_expression_then_bare_identifier_known_limitation() -> None:
    """
    Pins the known limitation documented on ``_STATEMENT_START_PREV_TEXTS``:
    a scalar ``CASE`` expression whose ``THEN`` branch is a bare identifier
    spelled like a block-opening keyword fails to parse inside a routine
    body, because it is indistinguishable from a procedural statement
    starting there without tracking statement-vs-expression context.
    """
    sql = """
WITH FUNCTION f(x int)
  RETURNS int
  BEGIN
    DECLARE a int DEFAULT CASE x WHEN 1 THEN if ELSE 0 END;
    RETURN a;
  END
SELECT f(1)
    """.strip()
    SQLScript(sql, "trino")
