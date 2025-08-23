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
import os
import time
from collections.abc import Iterator
from typing import Any, Callable, Optional, Union
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects.mysql.base import MySQLDialect
from sqlalchemy.dialects.postgresql.base import PGDialect
from sqlalchemy.exc import NoSuchTableError
from sqlalchemy.orm import Query, Session

from superset.utils import json

logger = logging.getLogger(__name__)

DEFAULT_BATCH_SIZE = int(os.environ.get("BATCH_SIZE", 1000))


def get_table_column(
    table_name: str,
    column_name: str,
) -> Optional[list[dict[str, Any]]]:
    """
    Get the specified column.

    :param table_name: The Table name
    :param column_name: The column name
    :returns: The column
    """

    insp = inspect(op.get_context().bind)

    try:
        for column in insp.get_columns(table_name):
            if column["name"] == column_name:
                return column
    except NoSuchTableError:
        pass

    return None


def table_has_column(table_name: str, column_name: str) -> bool:
    """
    Checks if a column exists in a given table.

    :param table_name: A table name
    :param column_name: A column name
    :returns: True iff the column exists in the table
    """

    return bool(get_table_column(table_name, column_name))


def table_has_index(table: str, index: str) -> bool:
    """
    Checks if an index exists in a given table.

    :param table: A table name
    :param index: A index name
    :returns: True if the index exists in the table
    """

    insp = inspect(op.get_context().bind)

    try:
        return any(ind["name"] == index for ind in insp.get_indexes(table))
    except NoSuchTableError:
        return False


uuid_by_dialect = {
    MySQLDialect: "UNHEX(REPLACE(CONVERT(UUID() using utf8mb4), '-', ''))",
    PGDialect: "uuid_in(md5(random()::text || clock_timestamp()::text)::cstring)",
}


def assign_uuids(
    model: Any, session: Session, batch_size: int = DEFAULT_BATCH_SIZE
) -> None:
    """Generate new UUIDs for all rows in a table"""
    bind = op.get_bind()
    table_name = model.__tablename__
    count = session.query(model).count()
    # silently skip if the table is empty (suitable for db initialization)
    if count == 0:
        return

    start_time = time.time()
    print(f"\nAdding uuids for `{table_name}`...")
    # Use dialect specific native SQL queries if possible
    for dialect, sql in uuid_by_dialect.items():
        if isinstance(bind.dialect, dialect):
            op.execute(
                f"UPDATE {dialect().identifier_preparer.quote(table_name)} SET uuid = {sql}"
            )
            print(f"Done. Assigned {count} uuids in {time.time() - start_time:.3f}s.\n")
            return

    for obj in paginated_update(
        session.query(model),
        lambda current, total: print(
            f"  uuid assigned to {current} out of {total}", end="\r"
        ),
        batch_size=batch_size,
    ):
        obj.uuid = uuid4
    print(f"Done. Assigned {count} uuids in {time.time() - start_time:.3f}s.\n")


def paginated_update(
    query: Query,
    print_page_progress: Optional[Union[Callable[[int, int], None], bool]] = None,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> Iterator[Any]:
    """
    Update models in small batches so we don't have to load everything in memory.
    """

    total = query.count()
    processed = 0
    session: Session = inspect(query).session
    result = session.execute(query)

    if print_page_progress is None or print_page_progress is True:
        print_page_progress = lambda processed, total: print(  # noqa: E731
            f"    {processed}/{total}", end="\r"
        )

    while True:
        rows = result.fetchmany(batch_size)

        if not rows:
            break

        for row in rows:
            yield row[0]

        session.commit()
        processed += len(rows)

        if print_page_progress:
            print_page_progress(processed, total)


def try_load_json(data: Optional[str]) -> dict[str, Any]:
    try:
        return data and json.loads(data) or {}
    except json.JSONDecodeError:
        print(f"Failed to parse: {data}")
        return {}


def has_table(table_name: str) -> bool:
    """
    Check if a table exists in the database.

    :param table_name: The table name
    :returns: True if the table exists
    """

    insp = inspect(op.get_context().bind)
    table_exists = insp.has_table(table_name)

    return table_exists


def add_column_if_not_exists(table_name: str, column: sa.Column) -> None:
    """
    Adds a column to a table if it does not already exist.

    :param table_name: Name of the table.
    :param column: SQLAlchemy Column object.
    """
    if not table_has_column(table_name, column.name):
        print(f"Adding column '{column.name}' to table '{table_name}'.\n")
        op.add_column(table_name, column)
    else:
        print(f"Column '{column.name}' already exists in table '{table_name}'.\n")
