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

from __future__ import annotations

import typing as t

from sqlglot import exp
from sqlglot.dialects.trino import Trino as SqlglotTrino
from sqlglot.tokens import Token, TokenType

# Keywords that open a block terminated by ``END`` in Trino SQL routines
# (https://trino.io/docs/current/udf/sql.html). ``CASE`` is included because
# both the ``CASE`` statement and the ``CASE`` expression are terminated by
# ``END``, so counting them keeps the depth balanced either way.
BLOCK_OPENERS: set[str] = {"BEGIN", "CASE", "IF", "LOOP", "REPEAT", "WHILE"}

# Keywords that are also scalar functions in Trino (e.g. ``IF(a, b, c)`` and
# ``REPEAT('a', 3)``). When immediately followed by ``(`` they are function
# calls, not block openers, unless the token stream shows otherwise (see
# ``_is_paren_condition_block``).
AMBIGUOUS_OPENERS: set[str] = {"IF", "REPEAT"}

BODY_KEYWORDS: tuple[str, str] = ("RETURN", "BEGIN")


def _is_paren_condition_block(tokens: t.Sequence[Token], paren_index: int) -> bool:
    """
    Determine whether the parenthesized group starting at ``tokens[paren_index]``
    (an ``L_PAREN``) is a procedural block condition, e.g. ``IF (a > b) THEN``,
    as opposed to a scalar function call argument list, e.g. ``IF(a, b, c)``.

    Only ``IF`` has this ambiguity: a parenthesized condition is followed by
    ``THEN``, while a scalar function call's closing paren never is.
    """
    depth = 0
    for i in range(paren_index, len(tokens)):
        token_type = tokens[i].token_type
        if token_type == TokenType.L_PAREN:
            depth += 1
        elif token_type == TokenType.R_PAREN:
            depth -= 1
            if depth == 0:
                next_token = tokens[i + 1] if i + 1 < len(tokens) else None
                return (
                    next_token is not None and next_token.token_type == TokenType.THEN
                )
    return False


class InlineUDF(exp.CTE):
    """
    An inline SQL user-defined function declared in a ``WITH`` clause.

    Trino supports declaring UDFs inline as part of a query::

        WITH FUNCTION meaning_of_life()
          RETURNS tinyint
          BEGIN
            DECLARE a tinyint DEFAULT CAST(6 AS tinyint);
            DECLARE b tinyint DEFAULT CAST(7 AS tinyint);
            RETURN a * b;
          END
        SELECT meaning_of_life()

    The function definition is stored verbatim as an opaque string (wrapped
    in an ``exp.Var`` so that AST traversal helpers see an expression), since
    sqlglot has no representation for SQL routine bodies. Trino does not
    allow queries inside SQL UDF bodies, so no table references are hidden
    by the opaque representation.

    This subclasses ``exp.CTE`` because ``sqlglot.parser.Parser._parse_with``
    only collects ``exp.CTE`` instances into the ``WITH`` clause.
    """

    arg_types = {"this": True}


class Trino(SqlglotTrino):
    """
    Custom Trino dialect with support for inline SQL UDFs.

    sqlglot cannot parse Trino SQL routine syntax; see
    https://github.com/tobymao/sqlglot/issues/5178. There are two separate
    problems:

    1. The parser splits statements on every semicolon, including the ones
       inside a ``BEGIN ... END`` routine body.
    2. The ``FUNCTION`` specification in a ``WITH`` clause is not valid CTE
       syntax.

    This dialect keeps routine bodies intact when splitting statements, and
    parses inline function specifications into opaque `InlineUDF` nodes that
    regenerate verbatim.

    Note that sqlglot's ``Dialect`` metaclass registers subclasses by class
    name, so once this module is imported this class also replaces the
    built-in dialect for string-based lookups (``dialect="trino"``). This is
    intentional, and consistent with how other Superset dialects (e.g.
    ``Dremio``) shadow their sqlglot counterparts: the extensions are purely
    additive, only activating on syntax that fails to parse upstream.
    """

    class Parser(SqlglotTrino.Parser):
        @staticmethod
        def _block_depth_delta(
            tokens: list[Token],
            index: int,
            prev_text: str,
        ) -> int:
            """
            Compute the block nesting change contributed by the routine token
            at ``tokens[index]``.
            """
            text = tokens[index].text.upper()
            if text in BLOCK_OPENERS:
                if prev_text == "END":
                    return 0  # block terminator, e.g. `END IF`, `END CASE`
                next_token = tokens[index + 1] if index + 1 < len(tokens) else None
                if (
                    text in AMBIGUOUS_OPENERS
                    and next_token
                    and next_token.token_type == TokenType.L_PAREN
                ):
                    if text == "IF" and _is_paren_condition_block(tokens, index + 1):
                        return 1  # procedural `IF (...) THEN`, not a call
                    return 0  # scalar function call, e.g. `IF(a, b, c)`
                return 1
            if text == "END":
                return -1
            return 0

        @staticmethod
        def _starts_routine(
            heads: list[TokenType],
            paren_depth: int,
        ) -> bool:
            """
            Determine whether a ``FUNCTION`` token at the end of ``heads``
            (excluded from the list) begins a new routine specification:
            ``CREATE FUNCTION``, ``CREATE OR REPLACE FUNCTION``, or an entry
            in a ``WITH`` list, either right after ``WITH`` itself or after a
            top-level comma separating it from a preceding CTE, e.g.
            ``WITH cte AS (...), FUNCTION f() ...``.
            """
            if heads[:1] == [TokenType.CREATE]:
                return heads in (
                    [TokenType.CREATE],
                    [TokenType.CREATE, TokenType.OR, TokenType.REPLACE],
                )
            if heads[:1] == [TokenType.WITH]:
                return paren_depth == 0 and heads[-1] in (
                    TokenType.WITH,
                    TokenType.COMMA,
                )
            return False

        def _parse(
            self,
            parse_method: t.Callable[..., exp.Expression | None],
            raw_tokens: list[Token],
            sql: str | None = None,
        ) -> list[exp.Expression | None]:
            """
            Split tokens into statements, keeping routine bodies intact.

            This is a copy of ``sqlglot.parser.Parser._parse`` (as of
            sqlglot 30.8.0, the version pinned in ``requirements/base.txt``)
            with one change: when a statement starts with ``WITH FUNCTION``,
            ``CREATE FUNCTION``, or ``CREATE OR REPLACE FUNCTION``, semicolons
            inside ``BEGIN ... END`` blocks do not split the statement. If
            sqlglot's own ``_parse`` changes on a future upgrade, this copy
            will silently drift from it and should be re-diffed against the
            new version.
            """
            self.reset()
            self.sql = sql or ""

            total = len(raw_tokens)
            chunks: list[list[Token]] = [[]]
            routine_mode: bool = False
            depth: int = 0
            paren_depth: int = 0
            prev_text: str = ""

            for i, token in enumerate(raw_tokens):
                if token.token_type == TokenType.SEMICOLON and depth <= 0:
                    if token.comments:
                        chunks.append([token])
                    if i < total - 1:
                        chunks.append([])
                    routine_mode = False
                    depth = 0
                    paren_depth = 0
                    prev_text = ""
                    continue

                chunk = chunks[-1]
                chunk.append(token)

                if token.token_type == TokenType.FUNCTION and not routine_mode:
                    heads = [tok.token_type for tok in chunk[:-1]]
                    routine_mode = self._starts_routine(heads, paren_depth)
                elif routine_mode:
                    depth += self._block_depth_delta(raw_tokens, i, prev_text)

                if token.token_type == TokenType.L_PAREN:
                    paren_depth += 1
                elif token.token_type == TokenType.R_PAREN:
                    paren_depth -= 1

                prev_text = token.text.upper()

            self._chunks = chunks
            return self._parse_batch_statements(
                parse_method=parse_method,
                sep_first_statement=False,
            )

        def _parse_cte(self) -> exp.CTE | None:
            """
            Parse a single entry in a ``WITH`` clause.

            An entry starting with the ``FUNCTION`` keyword followed by an
            identifier is an inline UDF specification; anything else
            (including a CTE named "function") is handled by sqlglot.
            """
            if (
                self._curr
                and self._curr.token_type == TokenType.FUNCTION
                and self._next
                and self._next.token_type
                not in (TokenType.ALIAS, TokenType.L_PAREN, TokenType.COMMA)
            ):
                return self._parse_inline_udf()

            return super()._parse_cte()

        def _parse_inline_udf(self) -> InlineUDF:
            """
            Consume an inline UDF specification and return it verbatim.

            The specification is ``FUNCTION name(params) RETURNS type`` plus
            optional routine characteristics, followed by a body that is
            either ``RETURN expression`` or a ``BEGIN ... END`` block.
            """
            start = self._curr
            self._advance()

            # scan for the start of the function body, skipping over the
            # signature, return type, and routine characteristics
            paren_depth: int = 0
            body: str | None = None
            while self._curr:
                token_type = self._curr.token_type
                text = self._curr.text.upper()
                if token_type == TokenType.L_PAREN:
                    paren_depth += 1
                elif token_type == TokenType.R_PAREN:
                    paren_depth -= 1
                elif paren_depth == 0 and text in BODY_KEYWORDS:
                    body = text
                    break
                self._advance()

            if body is None:
                self.raise_error(
                    "Expected RETURN or BEGIN in inline function specification"
                )

            if body == "RETURN":
                self._advance()
                if not self._parse_expression():
                    self.raise_error("Expected expression after RETURN")
            else:
                self._consume_block()

            raw = self.sql[start.start : self._prev.end + 1]
            return self.expression(InlineUDF(this=exp.Var(this=raw)), token=start)

        def _consume_block(self) -> None:
            """
            Consume a ``BEGIN ... END`` block, tracking nested blocks.
            """
            depth: int = 0
            while self._curr:
                text = self._curr.text.upper()
                if text in BLOCK_OPENERS:
                    is_scalar_call = (
                        text in AMBIGUOUS_OPENERS
                        and self._next
                        and self._next.token_type == TokenType.L_PAREN
                        and not (
                            text == "IF"
                            and _is_paren_condition_block(self._tokens, self._index + 1)
                        )
                    )
                    if is_scalar_call:
                        pass  # scalar function call, e.g. `IF(a, b, c)`
                    else:
                        depth += 1
                    self._advance()
                elif text == "END":
                    depth -= 1
                    self._advance()
                    if (
                        depth > 0
                        and self._curr
                        and self._curr.text.upper() in BLOCK_OPENERS
                    ):
                        # block terminator, e.g. `END IF`, `END CASE`
                        self._advance()
                    if depth == 0:
                        return
                else:
                    self._advance()

            self.raise_error("Unbalanced BEGIN/END in inline function specification")

    class Generator(SqlglotTrino.Generator):
        TRANSFORMS = {
            **SqlglotTrino.Generator.TRANSFORMS,
            InlineUDF: lambda self, e: e.this.name,
        }
