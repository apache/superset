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
import logging
from typing import Any, Iterator, Optional, Set

from alembic import op
from sqlalchemy import engine_from_config
from sqlalchemy.engine import reflection
from sqlalchemy.exc import NoSuchTableError
from sqloxide import parse_sql

from superset.sql_parse import ParsedQuery, Table

logger = logging.getLogger("alembic")


# mapping between sqloxide and SQLAlchemy dialects
sqloxide_dialects = {
    "ansi": {"trino", "trinonative", "presto"},
    "hive": {"hive", "databricks"},
    "ms": {"mssql"},
    "mysql": {"mysql"},
    "postgres": {
        "cockroachdb",
        "hana",
        "netezza",
        "postgres",
        "postgresql",
        "redshift",
        "vertica",
    },
    "snowflake": {"snowflake"},
    "sqlite": {"sqlite", "gsheets", "shillelagh"},
    "clickhouse": {"clickhouse"},
}


def table_has_column(table: str, column: str) -> bool:
    """
    Checks if a column exists in a given table.

    :param table: A table name
    :param column: A column name
    :returns: True iff the column exists in the table
    """

    config = op.get_context().config
    engine = engine_from_config(
        config.get_section(config.config_ini_section), prefix="sqlalchemy."
    )
    insp = reflection.Inspector.from_engine(engine)
    try:
        return any(col["name"] == column for col in insp.get_columns(table))
    except NoSuchTableError:
        return False


def find_nodes_by_key(element: Any, target: str) -> Iterator[Any]:
    """
    Find all nodes in a SQL tree matching a given key.
    """
    if isinstance(element, list):
        for child in element:
            yield from find_nodes_by_key(child, target)
    elif isinstance(element, dict):
        for key, value in element.items():
            if key == target:
                yield value
            else:
                yield from find_nodes_by_key(value, target)


def extract_table_references(sql_text: str, sqla_dialect: str) -> Set[Table]:
    """
    Return all the dependencies from a SQL sql_text.
    """
    dialect = "generic"
    for dialect, sqla_dialects in sqloxide_dialects.items():
        if sqla_dialect in sqla_dialects:
            break
    try:
        tree = parse_sql(sql_text, dialect=dialect)
    except Exception:  # pylint: disable=broad-except
        logger.warning("Unable to parse query with sqloxide: %s", sql_text)
        # fallback to sqlparse
        parsed = ParsedQuery(sql_text)
        return parsed.tables

    return {
        Table(*[part["value"] for part in table["name"][::-1]])
        for table in find_nodes_by_key(tree, "Table")
    }
