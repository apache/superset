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

from sqlglot import exp
from sqlglot.dialects.tsql import TSQL


class MSSQL(TSQL):
    """
    A sqlglot dialect for Microsoft SQL Server.

    This dialect extends TSQL to handle MSSQL-specific requirements,
    particularly around OFFSET clauses which require ORDER BY.
    """

    class Generator(TSQL.Generator):
        """
        Custom generator for MSSQL that ensures ORDER BY is present when OFFSET is used.
        """

        def select_sql(self, expression: exp.Select) -> str:
            """
            Generate SELECT SQL, ensuring ORDER BY when OFFSET is present.

            MSSQL requires an ORDER BY clause when using OFFSET. If no ORDER BY
            is present but OFFSET is specified, we add a default ORDER BY clause.
            """
            # Check if this SELECT has OFFSET but no ORDER BY
            offset_expr = expression.args.get("offset")
            if offset_expr and not expression.args.get("order"):
                # Create a copy to avoid modifying the original expression
                expression = expression.copy()

                # Add a default ORDER BY clause using positional ordering
                # This is the safest approach that works across all scenarios
                order_col = exp.Literal.number("1")

                # Set the ORDER BY clause
                expression.set(
                    "order",
                    exp.Order(expressions=[exp.Ordered(this=order_col, desc=False)]),
                )

            return super().select_sql(expression)
