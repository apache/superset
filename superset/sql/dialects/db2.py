# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.

"""
IBM DB2 dialect.

DB2 uses labeled durations for date arithmetic (e.g., expr + 1 DAYS).
This syntax is non-standard and requires custom parser support.
"""

from __future__ import annotations

from sqlglot import exp, tokens
from sqlglot.dialects.dialect import rename_func
from sqlglot.dialects.postgres import Postgres

LABELED_DURATION_UNITS = {
    "MICROSECOND",
    "MICROSECONDS",
    "SECOND",
    "SECONDS",
    "MINUTE",
    "MINUTES",
    "HOUR",
    "HOURS",
    "DAY",
    "DAYS",
    "MONTH",
    "MONTHS",
    "YEAR",
    "YEARS",
}


class DB2Interval(exp.Expression):
    """DB2 labeled duration expression (e.g., '1 DAYS', '2 MONTHS')."""

    arg_types = {"this": True, "unit": True}


class DB2(Postgres):
    """
    IBM DB2 dialect.

    Extends PostgreSQL with support for labeled durations in date arithmetic.
    """

    class Tokenizer(Postgres.Tokenizer):
        """DB2 SQL tokenizer with support for DB2-specific keywords."""

        KEYWORDS = {
            **Postgres.Tokenizer.KEYWORDS,
            # Time units; can follow numbers in date arithmetic
            "MICROSECOND": tokens.TokenType.VAR,
            "MICROSECONDS": tokens.TokenType.VAR,
            "SECOND": tokens.TokenType.VAR,
            "SECONDS": tokens.TokenType.VAR,
            "MINUTE": tokens.TokenType.VAR,
            "MINUTES": tokens.TokenType.VAR,
            "HOUR": tokens.TokenType.VAR,
            "HOURS": tokens.TokenType.VAR,
            "DAY": tokens.TokenType.VAR,
            "DAYS": tokens.TokenType.VAR,
            "MONTH": tokens.TokenType.VAR,
            "MONTHS": tokens.TokenType.VAR,
            "YEAR": tokens.TokenType.VAR,
            "YEARS": tokens.TokenType.VAR,
        }

    class Parser(Postgres.Parser):
        """DB2 SQL parser with support for labeled durations."""

        def _parse_term(self, parse_mod: bool = True) -> exp.Expression | None:
            """
            Override term parsing to support DB2 labeled durations.

            This is called during expression parsing for addition/subtraction
            operations. We intercept patterns like `expr + 1 DAYS` and parse them
            specially. Everything else follows sqlglot's own implementation,
            including the ``parse_mod`` flag it passes while parsing LIMIT and
            OFFSET, and the other term operators (e.g. COLLATE).
            """
            this = self._parse_factor(parse_mod=parse_mod)

            while self._match_set(self.TERM):
                token_type = self._prev.token_type
                klass = self.TERM[token_type]
                comments = self._prev_comments
                expression = self._parse_factor(parse_mod=parse_mod)

                # Check if there's a time unit after the right side
                # This handles patterns like: expr + 1 DAYS, expr + (func()) DAYS
                if (
                    token_type in (tokens.TokenType.PLUS, tokens.TokenType.DASH)
                    and expression is not None
                    and self._curr
                    and self._curr.token_type == tokens.TokenType.VAR
                    and self._curr.text.upper() in LABELED_DURATION_UNITS
                ):
                    # Found a DB2 labeled duration
                    unit_token = self._curr
                    self._advance()
                    expression = DB2Interval(
                        this=expression,
                        unit=exp.Literal.string(unit_token.text.upper()),
                    )

                this = self.expression(
                    klass(this=this, expression=expression), comments=comments
                )
                if isinstance(this, exp.Collate):
                    self._normalize_collate(this)

            return this

    class Generator(Postgres.Generator):
        """DB2 SQL generator."""

        TRANSFORMS = {
            **Postgres.Generator.TRANSFORMS,
            # sqlglot 30 only auto-discovers <Name>_sql handlers for expression
            # classes that live in sqlglot.expressions.EXPR_CLASSES (the
            # registry is built once at module load via ``subclasses(__name__, Expr)``).
            # Custom Expression subclasses defined outside that module — like
            # DB2Interval below — must be wired up explicitly in TRANSFORMS.
            DB2Interval: lambda self, e: self.db2interval_sql(e),
            # Postgres renders DAY()/MONTH()/YEAR() as EXTRACT(... FROM ...),
            # but DB2 natively supports (and this dialect's docstring/tests
            # rely on) the plain function-call form, e.g. DAY("DATE").
            # Override the inherited Postgres transform to keep that syntax.
            exp.Day: rename_func("DAY"),
            exp.Month: rename_func("MONTH"),
            exp.Year: rename_func("YEAR"),
        }

        def db2interval_sql(self, expression: DB2Interval) -> str:
            """Generate SQL for DB2Interval expressions."""
            # Don't quote the unit (DAYS, MONTHS, etc.) - it's a keyword, not a string
            unit = expression.args["unit"]
            unit_text = (
                unit.this if isinstance(unit, exp.Literal) else str(unit).upper()
            )
            return f"{self.sql(expression, 'this')} {unit_text}"
