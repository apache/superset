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
from typing import Any
from uuid import uuid4

from alembic import op
from sqlalchemy import engine_from_config
from sqlalchemy.dialects.mysql.base import MySQLDialect
from sqlalchemy.dialects.postgresql.base import PGDialect
from sqlalchemy.engine import reflection
from sqlalchemy.exc import NoSuchTableError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

DEFAULT_BATCH_SIZE = int(os.environ.get("BATCH_SIZE", 1000))


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

    # Othwewise Use Python uuid function
    start = 0
    while start < count:
        end = min(start + batch_size, count)
        for obj in session.query(model)[start:end]:
            obj.uuid = uuid4()
            session.merge(obj)
        session.commit()
        if start + batch_size < count:
            print(f"  uuid assigned to {end} out of {count}\r", end="")
        start += batch_size

    print(f"Done. Assigned {count} uuids in {time.time() - start_time:.3f}s.\n")
