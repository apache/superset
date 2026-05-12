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
RLS predicate injection via text splicing.

Instead of round-tripping through sqlglot's generator (which transpiles
dialect-specific functions like ``LAST_DAY`` into something else), this approach:

  1. Parses the SQL with sqlglot — only to understand structure (scope tree).
  2. Uses sqlglot's tokenizer to get byte-accurate positions for every token
     in the original SQL string.
  3. For each ``SELECT`` scope that references a table with an RLS predicate,
     finds the exact byte offset to inject at — either the end of an existing
     ``WHERE`` clause, or just before ``GROUP BY`` / ``ORDER BY`` / ``HAVING``
     / ``LIMIT`` / the closing paren of a subquery.
  4. Splices the predicate text directly into the original string at that
     offset — never calling ``.sql()``, so the generator never runs.

Result: everything outside the splice points is the original SQL, byte for
byte. Dialect-specific functions, comments, and formatting are all preserved
exactly.

Known limitations:
  - SQL that fails to parse under the chosen dialect raises a ``ParseError``.
    A thin dialect subclass is still required for parsing — but only for
    parsing, not generation.
  - Predicate strings are spliced in as raw SQL. They must come from a trusted
    source (the RLS config), not user input.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import sqlglot
from sqlglot import exp
from sqlglot.optimizer.scope import traverse_scope
from sqlglot.tokens import Token, TokenType

if TYPE_CHECKING:
    from superset.sql.parse import Table


# Token types that end a WHERE clause / FROM section at the current paren depth,
# indicating where a new predicate must be inserted just before.
_CLAUSE_ENDS = {
    TokenType.GROUP_BY,
    TokenType.HAVING,
    TokenType.ORDER_BY,
    TokenType.WINDOW,
    TokenType.QUALIFY,
    TokenType.LIMIT,
    TokenType.FETCH,
    TokenType.CLUSTER_BY,
    TokenType.DISTRIBUTE_BY,
    TokenType.SORT_BY,
    TokenType.CONNECT_BY,
    TokenType.START_WITH,
    TokenType.UNION,
    TokenType.INTERSECT,
    TokenType.EXCEPT,
}

_JOIN_STARTS = {
    TokenType.JOIN,
    TokenType.STRAIGHT_JOIN,
    TokenType.JOIN_MARKER,
}


def _splice_priority(text: str) -> int:
    """
    Priority for applying splices at the same offset.

    Insert full SQL fragments (WHERE/ON/predicates) before closing parens so
    wrapping splices like ``pred AND (existing)`` compose correctly.
    """
    return 1 if text != ")" else 0


def _after_previous_token(tokens: list[Token], index: int) -> int:
    """
    Return the offset immediately after the token preceding *index*.

    The sqlglot tokenizer strips comments and whitespace from the token stream,
    so the previous token's ``end + 1`` is the splice point that lands right
    after the last real SQL content — naturally skipping any intervening
    comments or whitespace, and never confusing ``--`` or ``/*`` inside string
    literals for real comment delimiters.
    """
    if index <= 0:
        return 0
    return tokens[index - 1].end + 1


def _table_from_node(
    node: exp.Table,
    catalog: str | None,
    schema: str | None,
) -> Table:
    """
    Build a fully qualified ``Table`` from a sqlglot ``exp.Table`` node, defaulting
    unqualified parts to the supplied catalog/schema.
    """
    # Imported lazily to avoid a circular import with ``superset.sql.parse``.
    from superset.sql.parse import Table

    return Table(
        table=node.name,
        schema=node.db if node.db else schema,
        catalog=node.catalog if node.catalog else catalog,
    )


def apply_rls_splice(
    sql: str,
    catalog: str | None,
    schema: str | None,
    predicates: dict[Table, list[str]],
    dialect: str | None = None,
) -> str:
    """
    Inject RLS predicates into ``sql`` by splicing text at the right positions.

    :param sql: The original SQL query. Returned unchanged except at splice points.
    :param catalog: The default catalog for non-qualified table names.
    :param schema: The default schema for non-qualified table names.
    :param predicates: Mapping of ``Table`` to predicate SQL strings. Each entry
        maps a fully qualified table to one or more raw predicate strings to
        ``AND`` together when that table is referenced in a SELECT scope.
    :param dialect: The sqlglot dialect used for *parsing only* — to understand
        scope structure and locate token positions. The generator is never
        called, so this does not affect output formatting.
    :return: The query with RLS predicates injected into every relevant SELECT
        scope.
    """
    if not predicates or not any(predicates.values()):
        return sql

    resolved_dialect = sqlglot.Dialect.get_or_raise(dialect)
    tokens = list(resolved_dialect.tokenize(sql))
    tree = sqlglot.parse_one(sql, dialect=dialect)

    splices: list[tuple[int, str]] = []
    for scope in traverse_scope(tree):
        splices.extend(
            _splices_for_scope(
                sql,
                tokens,
                scope,
                predicates,
                catalog,
                schema,
                dialect,
            )
        )

    # Apply splices in reverse offset order so earlier positions stay valid.
    # For equal offsets, apply predicate/WHERE/ON inserts before ")" inserts.
    splices.sort(key=lambda item: (item[0], _splice_priority(item[1])), reverse=True)
    result = sql
    for offset, text in splices:
        result = result[:offset] + text + result[offset:]
    return result


def _splices_for_scope(
    sql: str,
    tokens: list[Token],
    scope: object,
    predicates: dict[Table, list[str]],
    catalog: str | None,
    schema: str | None,
    dialect: str | None,
) -> list[tuple[int, str]]:
    """
    Compute all splices for a single SELECT scope.

    This mirrors ``RLSAsPredicateTransformer`` semantics:
      - predicates for FROM tables are applied to the SELECT WHERE clause as
        ``pred AND (existing_where)``
      - predicates for JOIN tables are applied to each JOIN ON clause as
        ``pred AND (existing_on)`` (or ``ON pred`` when ON is absent)
    """
    from_predicates: list[str] = []
    from_table_ends: list[int] = []
    join_splices: list[tuple[int, str]] = []

    for source in scope.sources.values():  # type: ignore[attr-defined]
        source_type, table_end, pred_sql = _classify_source_predicate(
            source,
            predicates,
            catalog,
            schema,
            dialect,
        )
        if source_type == "none" or table_end is None or pred_sql is None:
            continue

        if source_type == "from":
            from_predicates.append(pred_sql)
            from_table_ends.append(table_end)
            continue

        join_splice = _find_join_splice(sql, tokens, table_end, pred_sql)
        if join_splice:
            join_splices.extend(join_splice)
        continue

    if not from_predicates:
        return join_splices

    combined_predicates = " AND ".join(dict.fromkeys(from_predicates))
    from_splice = _find_where_splice(
        sql,
        tokens,
        max(from_table_ends),
        combined_predicates,
    )
    return [*join_splices, *from_splice]


def _table_end(source: exp.Table) -> int | None:
    ident = source.find(exp.Identifier)
    if ident and getattr(ident, "_meta", None):
        return ident._meta["end"]
    return None


def _classify_source_predicate(
    source: object,
    predicates: dict[Table, list[str]],
    catalog: str | None,
    schema: str | None,
    dialect: str | None,
) -> tuple[str, int | None, str | None]:
    """
    Return source kind (from/join/none), table end offset, and predicate SQL.
    """
    if not isinstance(source, exp.Table):
        return ("none", None, None)

    table = _table_from_node(source, catalog, schema)
    table_predicates = [
        _qualify_predicate(predicate, source, dialect)
        for predicate in predicates.get(table, [])
        if predicate
    ]
    if not table_predicates:
        return ("none", None, None)

    table_end = _table_end(source)
    if table_end is None:
        return ("none", None, None)

    pred_sql = " AND ".join(dict.fromkeys(table_predicates))
    if isinstance(source.parent, exp.From):
        return ("from", table_end, pred_sql)
    if isinstance(source.parent, exp.Join):
        return ("join", table_end, pred_sql)
    return ("none", None, None)


def _qualify_predicate(
    predicate: str,
    table_node: exp.Table,
    dialect: str | None,
) -> str:
    """
    Qualify predicate columns with the table alias/name, mirroring
    ``RLSAsPredicateTransformer``.
    """
    parsed = sqlglot.parse_one(predicate, dialect=dialect)
    table = table_node.alias_or_name
    table_expr = exp.to_identifier(table)
    for column in parsed.find_all(exp.Column):
        column.set("table", table_expr.copy())
    return parsed.sql(dialect=dialect)


def _scan_until_scope_boundary(
    tokens: list[Token],
    anchor: int,
    *,
    stop_at_join: bool,
) -> tuple[str, int | None]:
    """
    Scan tokens forward from ``anchor`` until a clause/scope boundary.

    Returns ``("where", index)`` when a WHERE token is found at depth 0,
    ``("boundary", index)`` for a non-WHERE boundary token, and
    ``("eof", None)`` when no boundary token is found.
    """
    depth = 0
    for i, tok in enumerate(tokens):
        if tok.start <= anchor:
            continue

        if tok.token_type == TokenType.L_PAREN:
            depth += 1
            continue

        if tok.token_type == TokenType.R_PAREN:
            if depth == 0:
                return ("boundary", i)
            depth -= 1
            continue

        if depth > 0:
            continue

        if tok.token_type == TokenType.WHERE:
            return ("where", i)

        if tok.token_type in _CLAUSE_ENDS or (
            stop_at_join and tok.token_type in _JOIN_STARTS
        ):
            return ("boundary", i)

    return ("eof", None)


def _find_condition_end(
    tokens: list[Token],
    start_index: int,
    *,
    stop_at_join: bool,
) -> int:
    """
    Find the end offset for a WHERE/ON condition body.
    """
    depth = 0
    prev_end = tokens[start_index].end
    for tok in tokens[start_index + 1 :]:
        if tok.token_type == TokenType.L_PAREN:
            depth += 1
        elif tok.token_type == TokenType.R_PAREN:
            if depth == 0:
                return prev_end + 1
            depth -= 1
        elif depth == 0 and (
            (stop_at_join and tok.token_type == TokenType.WHERE)
            or tok.token_type in _CLAUSE_ENDS
            or (stop_at_join and tok.token_type in _JOIN_STARTS)
        ):
            return prev_end + 1
        prev_end = tok.end
    return prev_end + 1


def _find_where_splice(
    sql: str,
    tokens: list[Token],
    anchor: int,
    pred_sql: str,
) -> list[tuple[int, str]]:
    """
    Build splices for adding predicate semantics to the SELECT WHERE clause:
    ``pred`` when absent, ``pred AND (existing)`` when present.
    """
    kind, idx = _scan_until_scope_boundary(tokens, anchor, stop_at_join=False)
    if kind == "where" and idx is not None:
        if idx + 1 >= len(tokens):
            return [(tokens[idx].end + 1, f" {pred_sql}")]
        body_start = tokens[idx + 1].start
        body_end = _find_condition_end(tokens, idx, stop_at_join=False)
        return [
            (body_start, f"{pred_sql} AND ("),
            (body_end, ")"),
        ]

    if kind == "boundary" and idx is not None:
        return [(_after_previous_token(tokens, idx), f" WHERE {pred_sql}")]

    return [(len(sql), f" WHERE {pred_sql}")]


def _find_join_splice(
    sql: str,
    tokens: list[Token],
    anchor: int,
    pred_sql: str,
) -> list[tuple[int, str]]:
    """
    Build splices for adding predicate semantics to a JOIN clause:
    ``ON pred`` when ON absent, ``ON pred AND (existing_on)`` when present.
    """
    on_index, boundary_index = _scan_join_clause(tokens, anchor)

    if on_index is not None:
        if on_index + 1 >= len(tokens):
            return [(tokens[on_index].end + 1, f" {pred_sql}")]
        body_start = tokens[on_index + 1].start
        body_end = _find_condition_end(tokens, on_index, stop_at_join=True)
        return [
            (body_start, f"{pred_sql} AND ("),
            (body_end, ")"),
        ]

    if boundary_index is not None:
        return [(_after_previous_token(tokens, boundary_index), f" ON {pred_sql}")]

    return [(len(sql), f" ON {pred_sql}")]


def _scan_join_clause(
    tokens: list[Token],
    anchor: int,
) -> tuple[int | None, int | None]:
    """
    Find ON and boundary token indexes for a JOIN segment.
    """
    depth = 0
    on_index: int | None = None
    boundary_index: int | None = None

    for i, tok in enumerate(tokens):
        if tok.start <= anchor:
            continue

        if tok.token_type == TokenType.L_PAREN:
            depth += 1
            continue

        if tok.token_type == TokenType.R_PAREN:
            if depth == 0:
                boundary_index = i
                break
            depth -= 1
            continue

        if depth > 0:
            continue

        if tok.token_type == TokenType.ON and on_index is None:
            on_index = i
            continue

        if tok.token_type == TokenType.WHERE:
            boundary_index = i
            break

        if tok.token_type in _JOIN_STARTS or tok.token_type in _CLAUSE_ENDS:
            boundary_index = i
            break

    return on_index, boundary_index
