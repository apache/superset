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
from sqlglot import Dialect, exp

from superset.sql.parse import SQLStatement, Table
from superset.sql.rls_splice import (
    _classify_source_predicate,
    _find_condition_end,
    _find_join_splice,
    _find_where_splice,
    _scan_join_clause,
    _scan_until_scope_boundary,
    _splices_for_scope,
    _table_end,
    apply_rls_splice,
)


def _tokenize(sql: str) -> list[sqlglot.tokens.Token]:
    return list(Dialect.get_or_raise(None).tokenize(sql))


def _token_index(tokens: list[sqlglot.tokens.Token], token_type: object) -> int:
    return next(i for i, token in enumerate(tokens) if token.token_type == token_type)


def _token_by_text(
    tokens: list[sqlglot.tokens.Token], text: str
) -> sqlglot.tokens.Token:
    return next(token for token in tokens if token.text == text)


def test_split_source_returns_none_result_when_tokenize_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _BrokenDialect:
        @staticmethod
        def tokenize(_: str) -> list[sqlglot.tokens.Token]:
            raise sqlglot.errors.SqlglotError("boom")

    monkeypatch.setattr(
        "superset.sql.parse.Dialect.get_or_raise",
        lambda _: _BrokenDialect(),
    )
    assert SQLStatement._split_source("SELECT 1", "postgresql", 2) == [None, None]


def test_apply_rls_splice_ignores_empty_predicates() -> None:
    sql = "SELECT 1"
    assert apply_rls_splice(sql, None, None, {Table("foo"): []}) == sql


def test_apply_rls_splice_ignores_dash_dash_inside_string_literal() -> None:
    """
    Regression: the splice point must not be confused by ``--`` appearing
    inside a string literal. Earlier ``rfind("--", ...)`` logic mistook this
    for an inline comment and inserted the predicate inside the quoted text.
    """
    sql = "SELECT * FROM some_table WHERE note = '--x' GROUP BY id"
    spliced = apply_rls_splice(
        sql,
        None,
        None,
        {Table("some_table"): ["some_table.tenant_id = 42"]},
        dialect="postgres",
    )
    assert spliced == (
        "SELECT * FROM some_table WHERE some_table.tenant_id = 42 "
        "AND (note = '--x') GROUP BY id"
    )


def test_table_end_returns_none_without_metadata() -> None:
    source = exp.Table(this=exp.Identifier(this="foo"))
    assert _table_end(source) is None


def test_classify_source_predicate_returns_none_without_table_metadata() -> None:
    source = exp.Table(this=exp.Identifier(this="foo"))
    exp.From(this=source)
    result = _classify_source_predicate(
        source,
        {Table("foo"): ["id = 1"]},
        None,
        None,
        None,
    )
    assert result == ("none", None, None)


def test_classify_source_predicate_returns_none_for_unsupported_parent() -> None:
    source = exp.Table(this=exp.Identifier(this="foo"))
    source.this.meta["end"] = 3
    exp.Alias(this=source, alias=exp.Identifier(this="alias"))
    result = _classify_source_predicate(
        source,
        {Table("foo"): ["id = 1"]},
        None,
        None,
        None,
    )
    assert result == ("none", None, None)


def test_scan_until_scope_boundary_tracks_parenthesis_depth() -> None:
    sql = "SELECT * FROM t WHERE (a = 1)"
    tokens = _tokenize(sql)
    where_token = _token_by_text(tokens, "WHERE")
    assert _scan_until_scope_boundary(
        tokens, where_token.start, stop_at_join=False
    ) == (
        "eof",
        None,
    )


def test_find_condition_end_handles_subquery_closing_paren() -> None:
    sql = "SELECT * FROM (SELECT * FROM t WHERE a = 1)"
    tokens = _tokenize(sql)
    where_index = _token_index(tokens, sqlglot.tokens.TokenType.WHERE)
    end = _find_condition_end(tokens, where_index, stop_at_join=False)
    assert sql[end] == ")"


def test_find_condition_end_handles_parenthesized_expression() -> None:
    sql = "SELECT * FROM t WHERE (a = 1)"
    tokens = _tokenize(sql)
    where_index = _token_index(tokens, sqlglot.tokens.TokenType.WHERE)
    end = _find_condition_end(tokens, where_index, stop_at_join=False)
    assert end == len(sql)


def test_find_where_splice_handles_trailing_where_keyword() -> None:
    sql = "SELECT * FROM t WHERE"
    tokens = _tokenize(sql)
    splices = _find_where_splice(sql, tokens, anchor=0, pred_sql="t.id = 1")
    assert splices == [(len(sql), " t.id = 1")]


def test_find_join_splice_handles_trailing_on_keyword() -> None:
    sql = "SELECT * FROM a JOIN b ON"
    tokens = _tokenize(sql)
    b_token = _token_by_text(tokens, "b")
    splices = _find_join_splice(sql, tokens, b_token.end, "b.id = 1")
    assert splices == [(len(sql), " b.id = 1")]


def test_find_join_splice_inserts_on_before_where_boundary() -> None:
    sql = "SELECT * FROM a JOIN b WHERE x = 1"
    tokens = _tokenize(sql)
    b_token = _token_by_text(tokens, "b")
    splices = _find_join_splice(sql, tokens, b_token.end, "b.id = 1")
    assert splices == [(sql.index("WHERE") - 1, " ON b.id = 1")]


def test_scan_join_clause_covers_nested_parentheses_and_join_boundary() -> None:
    sql = "SELECT * FROM a JOIN b ON (a.id = b.id) JOIN c ON 1 = 1"
    tokens = _tokenize(sql)
    b_token = _token_by_text(tokens, "b")
    on_index, boundary_index = _scan_join_clause(tokens, b_token.end)
    assert on_index is not None
    assert boundary_index is not None
    assert tokens[boundary_index].token_type == sqlglot.tokens.TokenType.JOIN


def test_scan_join_clause_stops_at_outer_closing_paren() -> None:
    sql = "SELECT * FROM (SELECT * FROM a JOIN b) sub"
    tokens = _tokenize(sql)
    b_token = _token_by_text(tokens, "b")
    _, boundary_index = _scan_join_clause(tokens, b_token.end)
    assert boundary_index is not None
    assert tokens[boundary_index].token_type == sqlglot.tokens.TokenType.R_PAREN


def test_splices_for_scope_handles_empty_join_splice_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _Scope:
        sources = {"x": object()}

    sql = "SELECT 1"
    tokens = _tokenize(sql)
    monkeypatch.setattr(
        "superset.sql.rls_splice._classify_source_predicate",
        lambda *args, **kwargs: ("join", 0, "x.id = 1"),
    )
    monkeypatch.setattr(
        "superset.sql.rls_splice._find_join_splice",
        lambda *args, **kwargs: [],
    )
    assert (
        _splices_for_scope(
            sql,
            tokens,
            _Scope(),
            {Table("x"): ["x.id = 1"]},
            None,
            None,
            None,
        )
        == []
    )


def test_splices_for_scope_combines_join_and_from_splices(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _Scope:
        sources = {"f": object(), "j": object()}

    sql = "SELECT 1"
    tokens = _tokenize(sql)
    calls = [("from", 3, "f.id = 1"), ("join", 6, "j.id = 2")]

    def _fake_classify(*args: object, **kwargs: object) -> tuple[str, int, str]:
        return calls.pop(0)

    monkeypatch.setattr(
        "superset.sql.rls_splice._classify_source_predicate", _fake_classify
    )
    monkeypatch.setattr(
        "superset.sql.rls_splice._find_join_splice",
        lambda *args, **kwargs: [(50, " ON j.id = 2")],
    )
    monkeypatch.setattr(
        "superset.sql.rls_splice._find_where_splice",
        lambda *args, **kwargs: [(20, " WHERE f.id = 1")],
    )

    assert _splices_for_scope(
        sql,
        tokens,
        _Scope(),
        {Table("f"): ["id = 1"], Table("j"): ["id = 2"]},
        None,
        None,
        None,
    ) == [(50, " ON j.id = 2"), (20, " WHERE f.id = 1")]


def test_splices_for_scope_join_then_next_source(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _Scope:
        sources = {"j": object(), "f": object()}

    sql = "SELECT 1"
    tokens = _tokenize(sql)
    calls = [("join", 3, "j.id = 2"), ("none", None, None)]

    def _fake_classify(
        *args: object, **kwargs: object
    ) -> tuple[str, int | None, str | None]:
        return calls.pop(0)

    monkeypatch.setattr(
        "superset.sql.rls_splice._classify_source_predicate", _fake_classify
    )
    monkeypatch.setattr(
        "superset.sql.rls_splice._find_join_splice",
        lambda *args, **kwargs: [],
    )

    assert (
        _splices_for_scope(
            sql,
            tokens,
            _Scope(),
            {Table("j"): ["id = 2"]},
            None,
            None,
            None,
        )
        == []
    )
