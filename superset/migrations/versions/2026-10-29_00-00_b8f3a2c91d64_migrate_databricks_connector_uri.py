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

"""Use the SQLAlchemy 2 Databricks dialect for saved legacy connections.

Revision ID: b8f3a2c91d64
Revises: f72b6e9c104a

Only the URI prefix is rewritten. Credentials live in the separate encrypted
password column, which this migration never reads or writes. The extra marker
limits rollback to connections converted by this revision.
"""

from typing import Any

import sqlalchemy as sa
from alembic import op

from superset.utils import json

revision = "b8f3a2c91d64"
down_revision = "f72b6e9c104a"

LEGACY_PREFIX = "databricks+connector://"
NATIVE_PREFIX = "databricks://"
MARKER = "migrated_from_databricks_connector_uri"
BATCH_SIZE = 1000

# Deliberately independent of application models and encrypted column types.
databases = sa.table(
    "dbs",
    sa.column("id", sa.Integer),
    sa.column("sqlalchemy_uri", sa.String(1024)),
    sa.column("extra", sa.Text),
)


def _load_extra(value: str | None, database_id: int) -> dict[str, Any]:
    """Read extra without silently discarding malformed connection settings."""
    try:
        extra = json.loads(value) if value else {}
    except ValueError as ex:
        raise ValueError(f"Invalid extra for database {database_id}") from ex
    if not isinstance(extra, dict):
        raise ValueError(f"Invalid extra for database {database_id}")
    return extra


def _migrate(upgrading: bool) -> None:
    """Use keyset batches so rewriting the filter cannot skip later rows."""
    bind = op.get_bind()
    last_id = -1
    while True:
        query = sa.select(databases).where(databases.c.id > last_id)
        if upgrading:
            query = query.where(databases.c.sqlalchemy_uri.like(f"{LEGACY_PREFIX}%"))
        else:
            query = query.where(databases.c.extra.like(f"%{MARKER}%"))
        rows = bind.execute(query.order_by(databases.c.id).limit(BATCH_SIZE)).fetchall()
        if not rows:
            break
        for row in rows:
            last_id = row.id
            extra = _load_extra(row.extra, row.id)
            uri = row.sqlalchemy_uri
            if upgrading:
                # LIKE can be case-insensitive on some metadata databases.
                if not uri.startswith(LEGACY_PREFIX):
                    continue
                if MARKER in extra:
                    raise ValueError(
                        f"Migration marker already set for database {row.id}"
                    )
                uri = NATIVE_PREFIX + uri[len(LEGACY_PREFIX) :]
                extra[MARKER] = True
            else:
                if extra.get(MARKER) is not True:
                    continue
                if uri.startswith(NATIVE_PREFIX):
                    uri = LEGACY_PREFIX + uri[len(NATIVE_PREFIX) :]
                del extra[MARKER]
            bind.execute(
                databases.update()
                .where(databases.c.id == row.id)
                .values(sqlalchemy_uri=uri, extra=json.dumps(extra))
            )


def upgrade() -> None:
    """Convert legacy URIs without parsing or re-encoding their contents."""
    _migrate(upgrading=True)


def downgrade() -> None:
    """Restore only converted URIs, leaving natively created connections alone."""
    _migrate(upgrading=False)
