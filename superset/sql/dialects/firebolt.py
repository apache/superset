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

from sqlglot import exp, generator, parser, tokens
from sqlglot.dialects.dialect import Dialect
from sqlglot.helper import csv
from sqlglot.tokens import TokenType


class Firebolt(Dialect):
    """
    A sqlglot dialect for Firebolt.
    """

    class Parser(parser.Parser):
        """
        Custom parser for Firebolt.

        In Firebolt `NOT` has higher precedence than `IN`, so we need to wrap the
        expression in parentheses when we find a negated range.
        """

        UNARY_PARSERS = {
            **parser.Parser.UNARY_PARSERS,
            TokenType.NOT: lambda self: self.expression(
                exp.Not,
                this=self._parse_unary(),  # pylint: disable=protected-access
            ),
        }

        def _negate_range(
            self,
            this: exp.Expression | None = None,
        ) -> exp.Expression | None:
            if not this:
                return this

            return self.expression(exp.Not, this=self.expression(exp.Paren, this=this))

    class Generator(generator.Generator):
        """
        Custom generator for Firebolt.
        """

        TYPE_MAPPING = {
            **generator.Generator.TYPE_MAPPING,
            exp.DataType.Type.VARBINARY: "BYTEA",
        }

        def not_sql(self, expression: exp.Not) -> str:
            """
            Parenthesize negated expressions.

            Firebolt requires negated to be wrapped in parentheses, since NOT has higher
            precedence than IN.
            """
            if isinstance(expression.this, exp.In):
                return f"NOT ({self.sql(expression, 'this')})"

            return super().not_sql(expression)


class FireboltOld(Firebolt):
    """
    Dialect for the old version of Firebolt (https://old.docs.firebolt.io/).

    The main difference is that `UNNEST` is an operator like `JOIN`, instead of a
    function.
    """

    class Tokenizer(tokens.Tokenizer):
        STRING_ESCAPES = ["'", "\\"]

    class Parser(Firebolt.Parser):
        TABLE_ALIAS_TOKENS = Firebolt.Parser.TABLE_ALIAS_TOKENS - {TokenType.UNNEST}

        def _parse_join(
            self,
            skip_join_token: bool = False,
            parse_bracket: bool = False,
        ) -> exp.Join | None:
            if unnest := self._parse_unnest():
                return self.expression(exp.Join, this=unnest)

            return super()._parse_join(skip_join_token, parse_bracket)

        def _parse_unnest(self, with_alias: bool = True) -> exp.Unnest | None:
            if not self._match(TokenType.UNNEST):
                return None

            # parse expressions (col1 AS foo), instead of equalities as in the original
            # dialect
            expressions = self._parse_wrapped_csv(self._parse_expression)
            offset = self._match_pair(TokenType.WITH, TokenType.ORDINALITY)

            alias = self._parse_table_alias() if with_alias else None

            if alias:
                if self.dialect.UNNEST_COLUMN_ONLY:
                    if alias.args.get("columns"):
                        self.raise_error("Unexpected extra column alias in unnest.")

                    alias.set("columns", [alias.this])
                    alias.set("this", None)

                columns = alias.args.get("columns") or []
                if offset and len(expressions) < len(columns):
                    offset = columns.pop()

            if not offset and self._match_pair(TokenType.WITH, TokenType.OFFSET):
                self._match(TokenType.ALIAS)
                offset = self._parse_id_var(
                    any_token=False, tokens=self.UNNEST_OFFSET_ALIAS_TOKENS
                ) or exp.to_identifier("offset")

            return self.expression(
                exp.Unnest,
                expressions=expressions,
                alias=alias,
                offset=offset,
            )

    class Generator(Firebolt.Generator):
        def join_sql(self, expression: exp.Join) -> str:
            if not self.SEMI_ANTI_JOIN_WITH_SIDE and expression.kind in (
                "SEMI",
                "ANTI",
            ):
                side = None
            else:
                side = expression.side

            op_sql = " ".join(
                op
                for op in (
                    expression.method,
                    "GLOBAL" if expression.args.get("global") else None,
                    side,
                    expression.kind,
                    expression.hint if self.JOIN_HINTS else None,
                )
                if op
            )
            match_cond = self.sql(expression, "match_condition")
            match_cond = f" MATCH_CONDITION ({match_cond})" if match_cond else ""
            on_sql = self.sql(expression, "on")
            using = expression.args.get("using")

            if not on_sql and using:
                on_sql = csv(*(self.sql(column) for column in using))

            this = expression.this
            this_sql = self.sql(this)

            if exprs := self.expressions(expression):
                this_sql = f"{this_sql},{self.seg(exprs)}"

            if on_sql:
                on_sql = self.indent(on_sql, skip_first=True)
                space = self.seg(" " * self.pad) if self.pretty else " "
                if using:
                    on_sql = f"{space}USING ({on_sql})"
                else:
                    on_sql = f"{space}ON {on_sql}"
            elif not op_sql:
                # the main difference with the base dialect is the lack of comma before
                # an `UNNEST`
                if (
                    isinstance(this, exp.Lateral)
                    and this.args.get("cross_apply") is not None
                ) or isinstance(this, exp.Unnest):
                    return f" {this_sql}"

                return f", {this_sql}"

            if op_sql != "STRAIGHT_JOIN":
                op_sql = f"{op_sql} JOIN" if op_sql else "JOIN"

            return f"{self.seg(op_sql)} {this_sql}{match_cond}{on_sql}"
