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

from typing import Any

import sqlglot
from sqlglot import Dialects, exp
from sqlglot.errors import ParseError

from superset.sql.parse import SQLGLOT_DIALECTS


def get_sqlglot_dialect(database_backend: str) -> Any:
    """Map Superset database backend name to SQLGlot dialect."""
    return SQLGLOT_DIALECTS.get(database_backend, Dialects.DIALECT)


def sanitize_sql_with_sqlglot(
    raw_sql: str,
    database_backend: str,
    validate_structure: bool = True,
) -> str:
    """
    Sanitize a raw SQL WHERE/HAVING clause using SQLGlot.

    Parses the SQL into an AST and regenerates it with proper
    escaping for the target database dialect.

    Raises ValueError if SQL contains disallowed constructs
    (subqueries, DDL/DML commands, set operations).
    """
    if not raw_sql or not raw_sql.strip():
        return ""

    dialect = get_sqlglot_dialect(database_backend)

    try:
        parsed = sqlglot.parse_one(raw_sql, dialect=dialect)

        if validate_structure:
            _validate_sql_structure(parsed)

        return parsed.sql(dialect=dialect)

    except ParseError:
        return raw_sql
    except ValueError:
        raise
    except Exception:  # pylint: disable=broad-except
        return raw_sql


def _validate_sql_structure(parsed: exp.Expression) -> None:
    """Validate that parsed SQL doesn't contain dangerous constructs."""
    disallowed_ddl_types = [
        exp.Command,
        exp.Create,
        exp.Drop,
        exp.Insert,
        exp.Update,
        exp.Delete,
    ]

    if hasattr(exp, "AlterTable"):
        disallowed_ddl_types.append(exp.AlterTable)
    if hasattr(exp, "Truncate"):
        disallowed_ddl_types.append(exp.Truncate)

    disallowed_ddl_tuple = tuple(disallowed_ddl_types)

    for node in parsed.walk():
        if isinstance(node, (exp.Subquery, exp.Select)):
            raise ValueError("Subqueries are not allowed in filter clauses")

        if isinstance(node, disallowed_ddl_tuple):
            raise ValueError("SQL commands are not allowed in filter clauses")

        if isinstance(node, (exp.Union, exp.Intersect, exp.Except)):
            raise ValueError("Set operations are not allowed in filter clauses")


def is_ag_grid_viz_type(viz_type: str | None) -> bool:
    """Check if the visualization type is AG Grid table."""
    return viz_type == "ag-grid-table"
