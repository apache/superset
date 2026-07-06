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
BLOCK_OPENERS = {"BEGIN", "CASE", "IF", "LOOP", "REPEAT", "WHILE"}

# Keywords that are also scalar functions in Trino (e.g. ``IF(a, b, c)`` and
# ``REPEAT('a', 3)``). When immediately followed by ``(`` they are function
# calls, not block openers.
AMBIGUOUS_OPENERS = {"IF", "REPEAT"}

BODY_KEYWORDS = ("RETURN", "BEGIN")


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
            text: str,
            prev_text: str,
            next_token: Token | None,
        ) -> int:
            """
            Compute the block nesting change contributed by a routine token.
            """
            if text in BLOCK_OPENERS:
                if prev_text == "END":
                    return 0  # block terminator, e.g. `END IF`, `END CASE`
                if (
                    text in AMBIGUOUS_OPENERS
                    and next_token
                    and next_token.token_type == TokenType.L_PAREN
                ):
                    return 0  # scalar function call, e.g. `IF(a, b, c)`
                return 1
            if text == "END":
                return -1
            return 0

        def _parse(
            self,
            parse_method: t.Callable[..., exp.Expression | None],
            raw_tokens: list[Token],
            sql: str | None = None,
        ) -> list[exp.Expression | None]:
            """
            Split tokens into statements, keeping routine bodies intact.

            This is a copy of ``sqlglot.parser.Parser._parse`` with one
            change: when a statement starts with ``WITH FUNCTION``, ``CREATE
            FUNCTION``, or ``CREATE OR REPLACE FUNCTION``, semicolons inside
            ``BEGIN ... END`` blocks do not split the statement.
            """
            self.reset()
            self.sql = sql or ""

            total = len(raw_tokens)
            chunks: list[list[Token]] = [[]]
            routine_mode = False
            depth = 0
            prev_text = ""

            for i, token in enumerate(raw_tokens):
                if token.token_type == TokenType.SEMICOLON and depth <= 0:
                    if token.comments:
                        chunks.append([token])
                    if i < total - 1:
                        chunks.append([])
                    routine_mode = False
                    depth = 0
                    prev_text = ""
                    continue

                chunk = chunks[-1]
                chunk.append(token)

                if token.token_type == TokenType.FUNCTION and not routine_mode:
                    heads = [tok.token_type for tok in chunk[:-1]]
                    routine_mode = heads in (
                        [TokenType.WITH],
                        [TokenType.CREATE],
                        [TokenType.CREATE, TokenType.OR, TokenType.REPLACE],
                    )
                elif routine_mode:
                    text = token.text.upper()
                    next_token = raw_tokens[i + 1] if i < total - 1 else None
                    depth += self._block_depth_delta(text, prev_text, next_token)

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
            paren_depth = 0
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
            depth = 0
            while self._curr:
                text = self._curr.text.upper()
                if text in BLOCK_OPENERS:
                    if (
                        text in AMBIGUOUS_OPENERS
                        and self._next
                        and self._next.token_type == TokenType.L_PAREN
                    ):
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
