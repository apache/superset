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

from sqlglot import exp, generator, parser
from sqlglot.dialects.dialect import Dialect
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
                this=self._parse_unary(),
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
