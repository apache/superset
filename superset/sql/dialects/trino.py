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

# Scalar functions Trino allows calling without parentheses, e.g. plain
# ``current_user`` rather than ``current_user()``. These are the same
# no-paren functions sqlglot's base parser special-cases (unmodified by the
# Trino dialect), reused here rather than duplicated so this stays in sync
# with future sqlglot upgrades.
_NO_PAREN_FUNCTION_TOKEN_TYPES: frozenset[TokenType] = frozenset(
    SqlglotTrino.Parser.NO_PAREN_FUNCTIONS
)

# ``BEGIN``, ``CASE``, and ``END`` are reserved words in sqlglot's Trino
# tokenizer, so they always carry one of these dedicated token types when
# used as keywords, and a different one (``STRING``/``IDENTIFIER``) when
# used as a string literal or quoted identifier, e.g. the string ``'END'``
# or the quoted identifier ``"end"``. ``IF``, ``LOOP``, ``REPEAT``, and
# ``WHILE`` are not reserved, so the tokenizer emits ``VAR`` for them both
# when they're used as a keyword and when they're an unquoted identifier;
# requiring ``VAR`` still rules out string literals and quoted identifiers,
# which is the ambiguity ``_is_keyword_token`` guards against.
_RESERVED_BLOCK_TOKEN_TYPES: dict[str, TokenType] = {
    "BEGIN": TokenType.BEGIN,
    "CASE": TokenType.CASE,
    "END": TokenType.END,
}

# Token text that can immediately precede a new routine statement inside a
# ``BEGIN ... END`` body: the start of the body itself, a statement
# separator, a branch/loop keyword that introduces a nested statement list,
# or ``:`` following a statement label (e.g. ``top: WHILE ... END WHILE``).
# Used by ``_is_routine_keyword`` to tell a non-reserved block-opening
# keyword (``IF``, ``LOOP``, ``REPEAT``, ``WHILE``) apart from an unquoted
# routine parameter or column reference spelled the same way, since Trino
# does not reserve these words and its tokenizer emits ``VAR`` for both.
#
# Known limitation: ``THEN`` precedes a new statement in a procedural ``IF``
# or ``CASE`` *statement*, but also precedes a scalar value in a ``CASE``
# *expression* (e.g. ``DEFAULT CASE x WHEN 1 THEN if ELSE 0 END``), and both
# forms share the same tokens. A bare identifier spelled exactly ``if``,
# ``loop``, ``while``, or ``repeat`` immediately after ``THEN`` in a scalar
# ``CASE`` expression is therefore misread as a block opener. Resolving this
# would need to track statement-vs-expression context rather than a single
# lookback token, which is a bigger change than this heuristic scanner is
# meant to carry.
_STATEMENT_START_PREV_TEXTS: frozenset[str] = frozenset(
    {"BEGIN", ";", "THEN", "ELSE", "DO", "LOOP", "REPEAT", ":"}
)


def _is_keyword_token(token: Token, text: str) -> bool:
    """
    Determine whether ``token`` (whose upper-cased text is ``text``) is an
    actual occurrence of a routine keyword, as opposed to a string literal
    or quoted identifier that happens to spell the same word.
    """
    if (expected := _RESERVED_BLOCK_TOKEN_TYPES.get(text)) is not None:
        return token.token_type == expected
    return token.token_type == TokenType.VAR


def _is_routine_keyword(token: Token, text: str, prev_text: str) -> bool:
    """
    Determine whether ``token`` is an actual occurrence of a routine block
    keyword, as opposed to a string literal or quoted identifier that
    happens to spell the same word (see ``_is_keyword_token``), or, for the
    non-reserved keywords (``IF``, ``LOOP``, ``REPEAT``, ``WHILE``), an
    unquoted parameter or column reference spelled the same way, e.g. a UDF
    parameter named ``loop`` in ``RETURN loop``. A block-opening keyword only
    ever appears where a new statement can start, so ``prev_text`` (the
    upper-cased text of the immediately preceding token) is checked against
    ``_STATEMENT_START_PREV_TEXTS`` for these ambiguous, non-reserved words.
    """
    if not _is_keyword_token(token, text):
        return False
    if text in _RESERVED_BLOCK_TOKEN_TYPES:
        return True
    return prev_text in _STATEMENT_START_PREV_TEXTS


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


def _extract_function_calls(tokens: t.Sequence[Token]) -> list[exp.Anonymous]:
    """
    Scan the raw tokens of an inline UDF specification for scalar function
    calls, e.g. ``regexp_replace(...)`` in ``RETURN regexp_replace(...)``, so
    that ``SQLScript.check_functions_present`` still sees them even though
    the UDF body itself is kept as opaque, verbatim text.

    A call is any word-like token immediately followed by ``(``. Most scalar
    functions tokenize as plain ``VAR`` (Trino's tokenizer does not
    distinguish an unquoted identifier from an unreserved keyword), but a few
    (e.g. ``current_user``, ``localtime``) are reserved words with their own
    dedicated ``TokenType`` and would otherwise slip past a ``VAR``-only
    check while still being callable with parentheses, so the token text
    itself (rather than its type) decides whether it looks like a call head.
    This can also match a routine/parameter type name (e.g. ``varchar(10)``),
    a keyword used with parenthesized syntax (e.g. ``CAST(...)``, ``IN
    (...)``), or the UDF's own name at its declaration site; those false
    positives are harmless here, since this list is only used to check for
    the presence of specific denylisted function names, not to validate the
    call itself.

    A few functions (e.g. ``current_user``, ``current_timestamp``) are also
    callable with no parentheses at all, so those are matched separately by
    token type, regardless of what follows.
    """
    return [
        exp.Anonymous(this=tokens[i - 1].text)
        for i in range(1, len(tokens))
        if tokens[i].token_type == TokenType.L_PAREN
        and tokens[i - 1].text.isidentifier()
    ] + [
        exp.Anonymous(this=token.text)
        for token in tokens
        if token.token_type in _NO_PAREN_FUNCTION_TOKEN_TYPES
    ]


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
    by the opaque representation. Scalar function calls, however, would be
    hidden from ``SQLScript.check_functions_present`` (used to enforce
    ``DISALLOWED_SQL_FUNCTIONS``) since it walks the AST for ``exp.Func``
    nodes, so those are additionally extracted into ``expressions`` as
    ``exp.Anonymous`` nodes; they play no part in regenerating the SQL.

    This subclasses ``exp.CTE`` because ``sqlglot.parser.Parser._parse_with``
    only collects ``exp.CTE`` instances into the ``WITH`` clause.
    """

    arg_types = {"this": True, "expressions": False}


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
            token = tokens[index]
            text = token.text.upper()
            if text in BLOCK_OPENERS:
                if not _is_routine_keyword(token, text, prev_text):
                    return 0  # literal, identifier, or parameter reference
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
            if text == "END" and _is_routine_keyword(token, text, prev_text):
                return -1
            return 0

        @staticmethod
        def _starts_routine(
            heads: list[TokenType],
            next_token_type: TokenType | None,
            paren_depth: int,
        ) -> bool:
            """
            Determine whether a ``FUNCTION`` token at the end of ``heads``
            (excluded from the list) begins a new routine specification:
            ``CREATE FUNCTION``, ``CREATE OR REPLACE FUNCTION``, or an entry
            in a ``WITH`` list, either right after ``WITH`` itself or after a
            top-level comma separating it from a preceding CTE, e.g.
            ``WITH cte AS (...), FUNCTION f() ...``.

            In the ``WITH`` case, ``FUNCTION`` may also just be an ordinary
            CTE named "function", e.g. ``WITH function AS (...) SELECT ...``.
            ``next_token_type`` (the token immediately after ``FUNCTION``) is
            checked the same way ``_parse_cte`` disambiguates the two: a CTE
            named "function" is followed by ``AS``, ``(``, or a comma (for a
            column alias list), while a routine specification is followed by
            the function name.
            """
            if heads[:1] == [TokenType.CREATE]:
                return heads in (
                    [TokenType.CREATE],
                    [TokenType.CREATE, TokenType.OR, TokenType.REPLACE],
                )
            if heads[:1] == [TokenType.WITH]:
                return (
                    paren_depth == 0
                    and heads[-1] in (TokenType.WITH, TokenType.COMMA)
                    and next_token_type
                    not in (TokenType.ALIAS, TokenType.L_PAREN, TokenType.COMMA)
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

            This is a copy of ``sqlglot.parser.Parser._parse`` (verified to
            match through sqlglot 30.16.0, the version pinned in
            ``requirements/base.txt``) with one change:
            when a statement starts with ``WITH FUNCTION``, ``CREATE
            FUNCTION``, or ``CREATE OR REPLACE FUNCTION``, semicolons inside
            ``BEGIN ... END`` blocks do not split the statement. Because this
            is a hand-maintained copy rather than an extension through a
            public hook, it will silently drift if sqlglot's own ``_parse``
            changes on a future upgrade; re-diff this method against the new
            version whenever ``sqlglot`` is bumped in ``requirements/base.txt``.
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
                    next_token = raw_tokens[i + 1] if i + 1 < total else None
                    routine_mode = self._starts_routine(
                        heads,
                        next_token.token_type if next_token else None,
                        paren_depth,
                    )
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
            start_index = self._index
            self._advance()

            # scan for the start of the function body, skipping over the
            # signature, return type, and routine characteristics. The
            # ``_is_keyword_token`` check rules out a routine characteristic
            # whose string value happens to spell a body keyword, e.g.
            # ``COMMENT 'RETURN'`` or ``COMMENT 'BEGIN'``.
            paren_depth: int = 0
            body: str | None = None
            while self._curr:
                token_type = self._curr.token_type
                text = self._curr.text.upper()
                if token_type == TokenType.L_PAREN:
                    paren_depth += 1
                elif token_type == TokenType.R_PAREN:
                    paren_depth -= 1
                elif (
                    paren_depth == 0
                    and text in BODY_KEYWORDS
                    and _is_keyword_token(self._curr, text)
                ):
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
            calls = _extract_function_calls(self._tokens[start_index : self._index])
            return self.expression(
                InlineUDF(this=exp.Var(this=raw), expressions=calls), token=start
            )

        def _consume_block(self) -> None:
            """
            Consume a ``BEGIN ... END`` block, tracking nested blocks.
            """
            depth: int = 0
            prev_text: str = ""
            while self._curr:
                token = self._curr
                text = token.text.upper()
                if text in BLOCK_OPENERS and _is_routine_keyword(
                    token, text, prev_text
                ):
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
                    prev_text = text
                    self._advance()
                elif text == "END" and _is_routine_keyword(token, text, prev_text):
                    depth -= 1
                    prev_text = text
                    self._advance()
                    if (
                        depth > 0
                        and self._curr
                        and self._curr.text.upper() in BLOCK_OPENERS
                        and _is_keyword_token(self._curr, self._curr.text.upper())
                    ):
                        # block terminator, e.g. `END IF`, `END CASE`
                        prev_text = self._curr.text.upper()
                        self._advance()
                    if depth == 0:
                        return
                else:
                    prev_text = text
                    self._advance()

            self.raise_error("Unbalanced BEGIN/END in inline function specification")

    class Generator(SqlglotTrino.Generator):
        TRANSFORMS = {
            **SqlglotTrino.Generator.TRANSFORMS,
            InlineUDF: lambda self, e: e.this.name,
        }
