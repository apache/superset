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
from sqlglot.dialects.postgres import Postgres


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

        def _parse_term(self) -> exp.Expression | None:
            """
            Override term parsing to support DB2 labeled durations.

            This is called during expression parsing for addition/subtraction
            operations. We intercept patterns like `expr + 1 DAYS` and parse them
            specially.
            """
            this = self._parse_factor()
            if not this:
                return None

            while self._match_set((tokens.TokenType.PLUS, tokens.TokenType.DASH)):
                op = self._prev.token_type

                # Parse the right side of the + or -
                rhs = self._parse_factor()
                if not rhs:  # pragma: no cover
                    break

                # Check if there's a time unit after the right side
                # This handles patterns like: expr + 1 DAYS, expr + (func()) DAYS
                if (
                    self._curr
                    and self._curr.token_type == tokens.TokenType.VAR
                    and self._curr.text.upper()
                    in {
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
                ):
                    # Found a DB2 labeled duration
                    unit_token = self._curr
                    self._advance()

                    duration = DB2Interval(
                        this=rhs,
                        unit=exp.Literal.string(unit_token.text.upper()),
                    )

                    if op == tokens.TokenType.PLUS:
                        this = exp.Add(this=this, expression=duration)
                    else:
                        this = exp.Sub(this=this, expression=duration)
                else:
                    # Not a labeled duration - use normal Add/Sub
                    if op == tokens.TokenType.PLUS:
                        this = exp.Add(this=this, expression=rhs)
                    else:
                        this = exp.Sub(this=this, expression=rhs)

            return this

    class Generator(Postgres.Generator):
        """DB2 SQL generator."""

        TRANSFORMS = {
            **Postgres.Generator.TRANSFORMS,
        }

        def db2interval_sql(self, expression: DB2Interval) -> str:
            """Generate SQL for DB2Interval expressions."""
            # Don't quote the unit (DAYS, MONTHS, etc.) - it's a keyword, not a string
            unit = expression.args["unit"]
            unit_text = (
                unit.this if isinstance(unit, exp.Literal) else str(unit).upper()
            )
            return f"{self.sql(expression, 'this')} {unit_text}"
