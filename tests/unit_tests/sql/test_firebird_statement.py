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

"""
Tests for FirebirdStatement — the raw-string SQL statement class for Firebird.

Firebird uses non-standard syntax (DATEADD, SELECT FIRST N, EXTRACT) that is
not supported by sqlglot, so FirebirdStatement bypasses sqlglot entirely —
following the same pattern as KustoKQLStatement.
"""

import pytest

from superset.exceptions import SupersetParseError
from superset.sql.parse import (
    FirebirdStatement,
    LimitMethod,
    SQLScript,
)


# ---------------------------------------------------------------------------
# split_script
# ---------------------------------------------------------------------------


class TestFirebirdSplitScript:
    def test_single_statement(self) -> None:
        stmts = FirebirdStatement.split_script("SELECT * FROM t", "firebird")
        assert len(stmts) == 1
        assert stmts[0].format() == "SELECT * FROM t"

    def test_multiple_statements(self) -> None:
        sql = "SELECT 1; SELECT 2; SELECT 3"
        stmts = FirebirdStatement.split_script(sql, "firebird")
        assert len(stmts) == 3
        assert stmts[0].format() == "SELECT 1"
        assert stmts[1].format() == "SELECT 2"
        assert stmts[2].format() == "SELECT 3"

    def test_semicolons_in_strings_preserved(self) -> None:
        sql = "SELECT * FROM t WHERE name = 'foo;bar'"
        stmts = FirebirdStatement.split_script(sql, "firebird")
        assert len(stmts) == 1
        assert "foo;bar" in stmts[0].format()

    def test_trailing_semicolon(self) -> None:
        sql = "SELECT 1;"
        stmts = FirebirdStatement.split_script(sql, "firebird")
        assert len(stmts) == 1
        assert stmts[0].format() == "SELECT 1"

    def test_empty_script(self) -> None:
        stmts = FirebirdStatement.split_script("", "firebird")
        assert len(stmts) == 1


# ---------------------------------------------------------------------------
# _parse_statement
# ---------------------------------------------------------------------------


class TestFirebirdParseStatement:
    def test_single_statement(self) -> None:
        stmt = FirebirdStatement("SELECT 1", "firebird")
        assert stmt.format() == "SELECT 1"

    def test_invalid_engine(self) -> None:
        with pytest.raises(SupersetParseError, match="Invalid engine"):
            FirebirdStatement("SELECT 1", "postgresql")

    def test_multiple_statements_rejected(self) -> None:
        with pytest.raises(
            SupersetParseError,
            match="FirebirdStatement should have exactly one statement",
        ):
            FirebirdStatement("SELECT 1; SELECT 2", "firebird")


# ---------------------------------------------------------------------------
# is_select / is_mutating
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "sql, expected",
    [
        ("SELECT * FROM t", True),
        ("SELECT FIRST 10 * FROM t", True),
        ("WITH cte AS (SELECT 1) SELECT * FROM cte", True),
        ("INSERT INTO t VALUES (1)", False),
        ("UPDATE t SET x = 1", False),
        ("DELETE FROM t WHERE id = 1", False),
        ("CREATE TABLE t (id INT)", False),
        ("DROP TABLE t", False),
        ("ALTER TABLE t ADD col INT", False),
    ],
)
def test_firebird_is_select(sql: str, expected: bool) -> None:
    assert FirebirdStatement(sql, "firebird").is_select() == expected


@pytest.mark.parametrize(
    "sql, expected",
    [
        ("SELECT * FROM t", False),
        ("INSERT INTO t VALUES (1)", True),
        ("UPDATE t SET x = 1", True),
        ("DELETE FROM t WHERE id = 1", True),
        ("CREATE TABLE t (id INT)", True),
        ("DROP TABLE t", True),
        ("ALTER TABLE t ADD col INT", True),
        ("EXECUTE PROCEDURE sp_test", True),
    ],
)
def test_firebird_is_mutating(sql: str, expected: bool) -> None:
    assert FirebirdStatement(sql, "firebird").is_mutating() == expected


# ---------------------------------------------------------------------------
# LIMIT handling (SELECT FIRST <n>)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "sql, expected",
    [
        ("SELECT FIRST 10 * FROM t", 10),
        ("SELECT FIRST 100 a, b FROM t", 100),
        ("SELECT * FROM t", None),
    ],
)
def test_firebird_get_limit_value(sql: str, expected: int | None) -> None:
    assert FirebirdStatement(sql, "firebird").get_limit_value() == expected


@pytest.mark.parametrize(
    "sql, limit, expected",
    [
        (
            "SELECT FIRST 1000 * FROM t",
            10,
            "SELECT FIRST 10 * FROM t",
        ),
        (
            "SELECT * FROM t",
            10,
            "SELECT FIRST 10 * FROM t",
        ),
        (
            "SELECT FIRST 500 a, b FROM t WHERE x = 1 ORDER BY a",
            25,
            "SELECT FIRST 25 a, b FROM t WHERE x = 1 ORDER BY a",
        ),
    ],
)
def test_firebird_set_limit_value(sql: str, limit: int, expected: str) -> None:
    stmt = FirebirdStatement(sql, "firebird")
    stmt.set_limit_value(limit)
    assert stmt.format() == expected


# ---------------------------------------------------------------------------
# Firebird-specific SQL that would fail with sqlglot
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM t WHERE d >= DATEADD(-30 DAY TO CURRENT_DATE)",
        "SELECT FIRST 10 * FROM t",
        "SELECT EXTRACT(YEAR FROM d) AS yr, EXTRACT(MONTH FROM d) AS mo FROM t",
        (
            "SELECT CAST(EXTRACT(YEAR FROM col) || '-' "
            "|| EXTRACT(MONTH FROM col) || '-01' AS DATE) FROM t"
        ),
        "SELECT DATEADD(second, col, CAST('00:00:00' AS TIMESTAMP)) FROM t",
        "EXECUTE PROCEDURE my_proc('arg1', 2)",
    ],
)
def test_firebird_specific_syntax_no_parse_error(sql: str) -> None:
    """Creating a statement should succeed without errors."""
    stmt = FirebirdStatement(sql, "firebird")
    assert stmt.format() == sql


# ---------------------------------------------------------------------------
# format / optimize / misc
# ---------------------------------------------------------------------------


def test_firebird_format_preserves_sql() -> None:
    sql = "SELECT FIRST 10 a, b FROM t WHERE x > 1 ORDER BY a DESC"
    assert FirebirdStatement(sql, "firebird").format() == sql


def test_firebird_optimize_is_noop() -> None:
    stmt = FirebirdStatement("SELECT * FROM t", "firebird")
    optimized = stmt.optimize()
    assert optimized.format() == stmt.format()


def test_firebird_get_settings_empty() -> None:
    assert FirebirdStatement("SELECT 1", "firebird").get_settings() == {}


def test_firebird_tables_empty() -> None:
    """Tables are not extracted for Firebird (no parser)."""
    stmt = FirebirdStatement("SELECT * FROM my_table", "firebird")
    assert stmt.tables == set()


def test_firebird_parse_predicate_passthrough() -> None:
    stmt = FirebirdStatement("SELECT 1", "firebird")
    assert stmt.parse_predicate("a > 1") == "a > 1"


def test_firebird_check_functions_present() -> None:
    stmt = FirebirdStatement("SELECT VERSION() FROM t", "firebird")
    assert stmt.check_functions_present({"version"}) is True
    assert stmt.check_functions_present({"nonexistent"}) is False


# ---------------------------------------------------------------------------
# SQLScript integration
# ---------------------------------------------------------------------------


def test_firebird_sqlscript_split_and_format() -> None:
    sql = "SELECT 1; SELECT 2; SELECT 3"
    script = SQLScript(sql, "firebird")
    assert len(script.statements) == 3
    assert script.format() == "SELECT 1;\nSELECT 2;\nSELECT 3"


def test_firebird_sqlscript_has_mutation_false() -> None:
    assert SQLScript("SELECT * FROM t", "firebird").has_mutation() is False


def test_firebird_sqlscript_has_mutation_true() -> None:
    assert SQLScript("INSERT INTO t VALUES (1)", "firebird").has_mutation() is True


def test_firebird_sqlscript_dateadd_no_parse_error() -> None:
    """This is the exact query pattern that was failing before the fix."""
    sql = (
        "SELECT ag.CODIGO, ag.DATA, ag.HORA, med.NOME AS MEDICO "
        "FROM AGENDA ag "
        "LEFT JOIN PESSOAS med ON med.CODIGO = ag.CD_COLABORADOR "
        "WHERE ag.DATA >= DATEADD(-30 DAY TO CURRENT_DATE) "
        "ORDER BY ag.DATA DESC"
    )
    script = SQLScript(sql, "firebird")
    assert len(script.statements) == 1
    assert script.statements[0].is_select() is True
    assert script.statements[0].is_mutating() is False


def test_firebird_sqlscript_uses_firebird_statement() -> None:
    """SQLScript should use FirebirdStatement for engine='firebird'."""
    script = SQLScript("SELECT 1", "firebird")
    assert isinstance(script.statements[0], FirebirdStatement)
