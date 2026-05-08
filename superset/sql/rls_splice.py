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


def _before_whitespace(sql: str, offset: int) -> int:
    """Back up past any whitespace immediately before *offset*."""
    while offset > 0 and sql[offset - 1] in (" ", "\t", "\n", "\r"):
        offset -= 1
    return offset


def _before_trivia(sql: str, offset: int) -> int:
    """
    Back up past whitespace and adjacent comments immediately before *offset*.

    This ensures insertion points land before inline/block comments that appear
    between `FROM`/`WHERE` and the next clause keyword.
    """
    while True:
        offset = _before_whitespace(sql, offset)

        # Inline comment ending at offset, eg: "... -- comment\nGROUP BY".
        line_start = sql.rfind("\n", 0, offset) + 1
        inline_comment_start = sql.rfind("--", line_start, offset)
        if inline_comment_start != -1:
            offset = inline_comment_start
            continue

        # Block comment ending at offset, eg: "... /* comment */GROUP BY".
        if offset >= 2 and sql[offset - 2 : offset] == "*/":
            block_comment_start = sql.rfind("/*", 0, offset - 2)
            if block_comment_start != -1:
                offset = block_comment_start
                continue

        return offset


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
        splice = _splice_for_scope(sql, tokens, scope, predicates, catalog, schema)
        if splice is not None:
            splices.append(splice)

    # Apply splices in reverse offset order so earlier positions stay valid.
    splices.sort(key=lambda item: item[0], reverse=True)
    result = sql
    for offset, text in splices:
        result = result[:offset] + text + result[offset:]
    return result


def _splice_for_scope(
    sql: str,
    tokens: list[Token],
    scope: object,
    predicates: dict[Table, list[str]],
    catalog: str | None,
    schema: str | None,
) -> tuple[int, str] | None:
    """
    Compute the (offset, text) splice for a single SELECT scope, or ``None`` if
    the scope has no matching predicates or no usable anchor.
    """
    scope_preds = _collect_scope_predicates(scope, predicates, catalog, schema)
    if not scope_preds:
        return None

    # Anchor: rightmost character position among the table-name identifiers
    # directly owned by this scope. Used to skip past tokens that belong to
    # earlier parts of the query (projections, JOIN ON clauses, etc.).
    table_ends = [
        ident._meta["end"]
        for source in scope.sources.values()  # type: ignore[attr-defined]
        if isinstance(source, exp.Table)
        for ident in [source.find(exp.Identifier)]
        if ident and getattr(ident, "_meta", None)
    ]
    if not table_ends:
        return None

    has_where = scope.expression.args.get("where") is not None  # type: ignore[attr-defined]
    pred_sql = " AND ".join(scope_preds)
    return _find_splice_point(sql, tokens, max(table_ends), has_where, pred_sql)


def _collect_scope_predicates(
    scope: object,
    predicates: dict[Table, list[str]],
    catalog: str | None,
    schema: str | None,
) -> list[str]:
    """
    Collect the predicates that apply to direct Table sources in ``scope``,
    deduped while preserving order.
    """
    scope_preds: list[str] = []
    for source in scope.sources.values():  # type: ignore[attr-defined]
        if not isinstance(source, exp.Table):
            continue
        table = _table_from_node(source, catalog, schema)
        for predicate in predicates.get(table, []):
            if predicate and predicate not in scope_preds:
                scope_preds.append(predicate)
    return scope_preds


def _find_splice_point(
    sql: str,
    tokens: list[Token],
    anchor: int,
    has_where: bool,
    pred_sql: str,
) -> tuple[int, str] | None:
    """
    Scan tokens forward from ``anchor``, tracking paren depth, to find where to
    insert the RLS predicate for a single scope.
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
                # Closing paren of our subquery — insert just before it.
                offset = _before_trivia(sql, tok.start)
                text = f" AND {pred_sql}" if has_where else f" WHERE {pred_sql}"
                return (offset, text)
            depth -= 1
            continue

        if depth > 0:
            continue

        if has_where and tok.token_type == TokenType.WHERE:
            return _find_after_where(sql, tokens, i, pred_sql)

        if not has_where and tok.token_type in _CLAUSE_ENDS:
            # Insert WHERE before this clause keyword.
            return (_before_trivia(sql, tok.start), f" WHERE {pred_sql}")

    # No clause boundary found — append at end of SQL.
    text = f" AND {pred_sql}" if has_where else f" WHERE {pred_sql}"
    return (len(sql), text)


def _find_after_where(
    sql: str,
    tokens: list[Token],
    where_index: int,
    pred_sql: str,
) -> tuple[int, str] | None:
    """
    Given the index of a ``WHERE`` token in ``tokens``, find the offset just
    after the WHERE clause body where ``AND <pred>`` should be inserted.
    """
    depth = 0
    prev_end = tokens[where_index].end
    for tok in tokens[where_index + 1 :]:
        if tok.token_type == TokenType.L_PAREN:
            depth += 1
        elif tok.token_type == TokenType.R_PAREN:
            if depth == 0:
                return (_before_trivia(sql, tok.start), f" AND {pred_sql}")
            depth -= 1
        elif depth == 0 and tok.token_type in _CLAUSE_ENDS:
            return (_before_trivia(sql, tok.start), f" AND {pred_sql}")
        prev_end = tok.end
    return (prev_end + 1, f" AND {pred_sql}")
