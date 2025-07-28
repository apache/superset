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

from sqlglot import exp, generator, parser
from sqlglot.dialects.hive import Hive
from sqlglot.helper import seq_get


class Impala(Hive):
    """
    A sqlglot dialect for Impala.

    Impala is similar to Hive but with some key differences:
    - No support for LATERAL VIEW, use JOIN with UNNEST instead
    - Different date/time functions
    - No support for TRANSFORM
    - Limited support for certain Hive-specific features
    """

    class Parser(Hive.Parser):
        FUNCTIONS = {
            **Hive.Parser.FUNCTIONS,
            # Impala-specific functions
            "MONTHS_ADD": lambda args: exp.DateAdd(
                this=seq_get(args, 0),
                expression=seq_get(args, 1),
                unit=exp.Literal.string("MONTH"),
            ),
            "MONTHS_SUB": lambda args: exp.DateSub(
                this=seq_get(args, 0),
                expression=seq_get(args, 1),
                unit=exp.Literal.string("MONTH"),
            ),
            "YEARS_ADD": lambda args: exp.DateAdd(
                this=seq_get(args, 0),
                expression=seq_get(args, 1),
                unit=exp.Literal.string("YEAR"),
            ),
            "YEARS_SUB": lambda args: exp.DateSub(
                this=seq_get(args, 0),
                expression=seq_get(args, 1),
                unit=exp.Literal.string("YEAR"),
            ),
            "DAYS_ADD": lambda args: exp.DateAdd(
                this=seq_get(args, 0),
                expression=seq_get(args, 1),
                unit=exp.Literal.string("DAY"),
            ),
            "DAYS_SUB": lambda args: exp.DateSub(
                this=seq_get(args, 0),
                expression=seq_get(args, 1),
                unit=exp.Literal.string("DAY"),
            ),
            "WEEKS_ADD": lambda args: exp.DateAdd(
                this=seq_get(args, 0),
                expression=seq_get(args, 1),
                unit=exp.Literal.string("WEEK"),
            ),
            "WEEKS_SUB": lambda args: exp.DateSub(
                this=seq_get(args, 0),
                expression=seq_get(args, 1),
                unit=exp.Literal.string("WEEK"),
            ),
            # Impala uses different names for some functions
            "DATE_PART": lambda args: _parse_date_part(args),
            "EXTRACT": lambda args: _parse_extract(args),
            # Override Hive functions that Impala doesn't support
            "STR_TO_MAP": None,  # Not supported in Impala
            "XPATH": None,  # Not supported in Impala
            "XPATH_BOOLEAN": None,
            "XPATH_DOUBLE": None,
            "XPATH_FLOAT": None,
            "XPATH_INT": None,
            "XPATH_LONG": None,
            "XPATH_SHORT": None,
            "XPATH_STRING": None,
        }

        NO_PAREN_FUNCTION_PARSERS = {
            **parser.Parser.NO_PAREN_FUNCTION_PARSERS,
            # Remove TRANSFORM as it's not supported in Impala
        }
        NO_PAREN_FUNCTION_PARSERS.pop("TRANSFORM", None)

        def _parse_lateral(self) -> t.Optional[exp.Lateral]:
            # Impala doesn't support LATERAL VIEW, it uses different syntax
            # This prevents parsing LATERAL VIEW syntax
            return None

    class Generator(Hive.Generator):
        # Impala-specific type mappings
        TYPE_MAPPING = {
            **Hive.Generator.TYPE_MAPPING,
            exp.DataType.Type.VARCHAR: "STRING",  # Impala treats VARCHAR as STRING
            exp.DataType.Type.NVARCHAR: "STRING",
            exp.DataType.Type.CHAR: "STRING",  # Impala treats CHAR as STRING
            exp.DataType.Type.NCHAR: "STRING",
        }

        TRANSFORMS = {
            **Hive.Generator.TRANSFORMS,
            # Date/time functions
            exp.DateAdd: lambda self, e: _date_add_sql(self, e),
            exp.DateSub: lambda self, e: _date_sub_sql(self, e),
            # Impala doesn't support certain Hive features
            exp.StrToMap: lambda self, e: self.unsupported(
                "STR_TO_MAP is not supported in Impala"
            ),
            exp.Transform: lambda self, e: self.unsupported(
                "TRANSFORM is not supported in Impala"
            ),
            exp.QueryTransform: lambda self, e: self.unsupported(
                "TRANSFORM is not supported in Impala"
            ),
            # Override LATERAL VIEW handling
            exp.Lateral: lambda self, e: _lateral_sql(self, e),
            # JSON functions have different names in Impala
            exp.JSONExtract: lambda self, e: self.func(
                "JSON_QUERY", e.this, e.expression
            ),
            exp.JSONExtractScalar: lambda self, e: self.func(
                "JSON_VALUE", e.this, e.expression
            ),
            # Impala uses different syntax for COLLECT_LIST/SET
            exp.ArrayAgg: lambda self, e: self.func(
                "GROUP_CONCAT",
                e.this.this if isinstance(e.this, exp.Order) else e.this,
                exp.Literal.string(","),
            ),
            exp.ArrayUniqueAgg: lambda self, e: self.func(
                "GROUP_CONCAT",
                self.sql(exp.Distinct(expressions=[e.this])),
                exp.Literal.string(","),
            ),
        }

        def datatype_sql(self, expression: exp.DataType) -> str:
            # Impala treats CHAR/VARCHAR as STRING
            if expression.is_type("char", "varchar", "nchar", "nvarchar"):
                return "STRING"

            return super().datatype_sql(expression)

        def lateral_sql(self, expression: exp.Lateral) -> str:
            # Impala doesn't use LATERAL VIEW syntax
            # Instead, it uses regular JOIN with UNNEST
            if isinstance(expression.this, exp.Unnest):
                return self.sql(expression.this)
            return super().lateral_sql(expression)


def _parse_date_part(args: t.List[exp.Expression]) -> exp.Expression:
    """Parse DATE_PART function which extracts date parts."""
    part = seq_get(args, 0)
    date = seq_get(args, 1)

    if isinstance(part, exp.Literal):
        part_name = part.name.upper()
        if part_name == "YEAR":
            return exp.Year(this=date)
        elif part_name == "MONTH":
            return exp.Month(this=date)
        elif part_name == "DAY":
            return exp.Day(this=date)
        elif part_name == "HOUR":
            return exp.Hour(this=date)
        elif part_name == "MINUTE":
            return exp.Minute(this=date)
        elif part_name == "SECOND":
            return exp.Second(this=date)

    return exp.Extract(this=part, expression=date)


def _parse_extract(args: t.List[exp.Expression]) -> exp.Expression:
    """Parse EXTRACT function."""
    return exp.Extract(this=seq_get(args, 0), expression=seq_get(args, 1))


def _date_add_sql(self: generator.Generator, expression: exp.DateAdd) -> str:
    """Generate SQL for date addition in Impala."""
    unit = expression.text("unit").upper()

    # Map generic units to Impala-specific functions
    unit_map = {
        "YEAR": "YEARS_ADD",
        "MONTH": "MONTHS_ADD",
        "WEEK": "WEEKS_ADD",
        "DAY": "DAYS_ADD",
    }

    func_name = unit_map.get(unit, "DATE_ADD")

    if func_name != "DATE_ADD":
        return self.func(func_name, expression.this, expression.expression)

    # For other units, use DATE_ADD with INTERVAL
    return self.func(
        "DATE_ADD",
        expression.this,
        self.sql(exp.Interval(this=expression.expression, unit=expression.unit)),
    )


def _date_sub_sql(self: generator.Generator, expression: exp.DateSub) -> str:
    """Generate SQL for date subtraction in Impala."""
    unit = expression.text("unit").upper()

    # Map generic units to Impala-specific functions
    unit_map = {
        "YEAR": "YEARS_SUB",
        "MONTH": "MONTHS_SUB",
        "WEEK": "WEEKS_SUB",
        "DAY": "DAYS_SUB",
    }

    func_name = unit_map.get(unit, "DATE_SUB")

    if func_name != "DATE_SUB":
        return self.func(func_name, expression.this, expression.expression)

    # For other units, use DATE_SUB with INTERVAL
    return self.func(
        "DATE_SUB",
        expression.this,
        self.sql(exp.Interval(this=expression.expression, unit=expression.unit)),
    )


def _lateral_sql(self: generator.Generator, expression: exp.Lateral) -> str:
    """Generate SQL for LATERAL expressions in Impala."""
    # Impala doesn't support LATERAL VIEW syntax
    # It uses regular JOIN with UNNEST instead
    this = expression.this

    if isinstance(this, exp.Unnest):
        # Just return the UNNEST expression without LATERAL VIEW
        return self.sql(this)

    # For other cases, try to generate standard SQL
    return self.sql(this)
