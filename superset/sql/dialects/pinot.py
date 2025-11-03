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
MySQL ANSI dialect for Apache Pinot.

This dialect is based on MySQL but follows ANSI SQL quoting conventions where
double quotes are used for identifiers instead of string literals.
"""

from __future__ import annotations

from sqlglot import exp
from sqlglot.dialects.mysql import MySQL
from sqlglot.helper import seq_get
from sqlglot.tokens import TokenType


class Pinot(MySQL):
    """
    MySQL ANSI dialect used by Apache Pinot.

    The main difference from standard MySQL is that double quotes (") are used for
    identifiers instead of string literals, following ANSI SQL conventions.

    See: https://calcite.apache.org/javadocAggregate/org/apache/calcite/config/Lex.html#MYSQL_ANSI
    """

    class Tokenizer(MySQL.Tokenizer):
        QUOTES = ["'"]  # Only single quotes for strings
        IDENTIFIERS = ['"', "`"]  # Backticks and double quotes for identifiers
        STRING_ESCAPES = ["'", "\\"]  # Remove double quote from string escapes
        KEYWORDS = {
            **MySQL.Tokenizer.KEYWORDS,
            "STRING": TokenType.TEXT,
            "LONG": TokenType.BIGINT,
            "BYTES": TokenType.VARBINARY,
        }

    class Parser(MySQL.Parser):
        FUNCTIONS = {
            **MySQL.Parser.FUNCTIONS,
            "DATE_ADD": lambda args: exp.DateAdd(
                this=seq_get(args, 2),
                expression=seq_get(args, 1),
                unit=seq_get(args, 0),
            ),
            "DATE_SUB": lambda args: exp.DateSub(
                this=seq_get(args, 2),
                expression=seq_get(args, 1),
                unit=seq_get(args, 0),
            ),
        }

    class Generator(MySQL.Generator):
        TYPE_MAPPING = {
            **MySQL.Generator.TYPE_MAPPING,
            exp.DataType.Type.TINYINT: "INT",
            exp.DataType.Type.SMALLINT: "INT",
            exp.DataType.Type.INT: "INT",
            exp.DataType.Type.BIGINT: "LONG",
            exp.DataType.Type.FLOAT: "FLOAT",
            exp.DataType.Type.DOUBLE: "DOUBLE",
            exp.DataType.Type.BOOLEAN: "BOOLEAN",
            exp.DataType.Type.TIMESTAMP: "TIMESTAMP",
            exp.DataType.Type.TIMESTAMPTZ: "TIMESTAMP",
            exp.DataType.Type.VARCHAR: "STRING",
            exp.DataType.Type.CHAR: "STRING",
            exp.DataType.Type.TEXT: "STRING",
            exp.DataType.Type.BINARY: "BYTES",
            exp.DataType.Type.VARBINARY: "BYTES",
            exp.DataType.Type.JSON: "JSON",
        }

        # Override MySQL's CAST_MAPPING - don't convert integer or string types
        CAST_MAPPING = {
            exp.DataType.Type.LONGBLOB: exp.DataType.Type.VARBINARY,
            exp.DataType.Type.MEDIUMBLOB: exp.DataType.Type.VARBINARY,
            exp.DataType.Type.TINYBLOB: exp.DataType.Type.VARBINARY,
            exp.DataType.Type.UBIGINT: "UNSIGNED",
        }

        TRANSFORMS = {
            **MySQL.Generator.TRANSFORMS,
            exp.DateAdd: lambda self, e: self.func(
                "DATE_ADD",
                exp.Literal.string(str(e.args.get("unit").name)),
                e.args.get("expression"),
                e.this,
            ),
            exp.DateSub: lambda self, e: self.func(
                "DATE_SUB",
                exp.Literal.string(str(e.args.get("unit").name)),
                e.args.get("expression"),
                e.this,
            ),
            exp.Substring: lambda self, e: self.func(
                "SUBSTR",
                e.this,
                e.args.get("start"),
                e.args.get("length"),
            ),
            exp.StrPosition: lambda self, e: self.func(
                "STRPOS",
                e.this,
                e.args.get("substr"),
                e.args.get("position"),
            ),
            exp.StartsWith: lambda self, e: self.func(
                "STARTSWITH",
                e.this,
                e.args.get("expression"),
            ),
            exp.Chr: lambda self, e: self.func(
                "CHR",
                *e.args.get("expressions", []),
            ),
            exp.Mod: lambda self, e: self.func(
                "MOD",
                e.this,
                e.args.get("expression"),
            ),
            exp.ArrayAgg: lambda self, e: self.func(
                "ARRAY_AGG",
                e.this,
            ),
            exp.JSONExtractScalar: lambda self, e: self.func(
                "JSON_EXTRACT_SCALAR",
                e.this,
                e.args.get("expression"),
                e.args.get("variant"),
            ),
        }
        # Remove DATE_TRUNC transformation - Pinot supports standard SQL DATE_TRUNC
        TRANSFORMS.pop(exp.DateTrunc, None)

        def datatype_sql(self, expression: exp.DataType) -> str:
            # Don't use MySQL's VARCHAR size requirement logic
            # Just use TYPE_MAPPING for all types
            type_value = expression.this
            type_sql = (
                self.TYPE_MAPPING.get(type_value, type_value.value)
                if isinstance(type_value, exp.DataType.Type)
                else type_value
            )

            interior = self.expressions(expression, flat=True)
            nested = f"({interior})" if interior else ""

            if expression.this in self.UNSIGNED_TYPE_MAPPING:
                return f"{type_sql} UNSIGNED{nested}"

            return f"{type_sql}{nested}"

        def cast_sql(self, expression: exp.Cast, safe_prefix: str | None = None) -> str:
            # Pinot doesn't support MySQL's TIMESTAMP() function
            # Use standard CAST syntax instead
            return super(MySQL.Generator, self).cast_sql(expression, safe_prefix)
