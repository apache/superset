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
and a migration-owned fingerprint table limit rollback to unchanged converted rows.
"""

from datetime import datetime
from hashlib import sha256
from typing import Any

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared.utils import create_table, drop_table, has_table
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
    sa.column("changed_on", sa.DateTime),
)


# Fingerprints avoid copying connection settings or credentials into a backup table.
records = sa.table(
    "databricks_uri_migration",
    sa.column("id", sa.Integer),
    sa.column("fingerprint", sa.String(64)),
    sa.column("extra_marked", sa.Boolean),
)


def _load_extra(value: str | None) -> dict[str, Any] | None:
    """Return no object for malformed settings, without replacing their text."""
    try:
        extra = json.loads(value) if value is not None else None
    except (ValueError, RecursionError):
        return None
    return extra if isinstance(extra, dict) else None


def _fingerprint(uri: str, extra: str | None, changed_on: datetime | None) -> str:
    """Recognize the migrated state, including edits to other database fields."""
    state = json.dumps([uri, extra, str(changed_on)])
    return sha256(state.encode("utf-8")).hexdigest()


def _query(upgrading: bool, tracked: bool, last_id: int) -> sa.sql.Select:
    """Find source URIs or rollback candidates, including exported markers."""
    query = sa.select(databases).where(databases.c.id > last_id)
    if upgrading:
        query = query.where(databases.c.sqlalchemy_uri.like(f"{LEGACY_PREFIX}%"))
    elif tracked:
        query = (
            query.add_columns(records.c.fingerprint, records.c.extra_marked)
            .select_from(databases.outerjoin(records, databases.c.id == records.c.id))
            .where(
                sa.or_(records.c.id.isnot(None), databases.c.extra.like(f"%{MARKER}%"))
            )
        )
    else:
        query = query.add_columns(
            sa.literal(None).label("fingerprint"),
            sa.literal(None).label("extra_marked"),
        ).where(databases.c.extra.like(f"%{MARKER}%"))
    return query


def _migrate(upgrading: bool) -> None:
    """Use keyset batches so rewriting the filter cannot skip later rows."""
    bind = op.get_bind()
    tracked = has_table(records.name)
    last_id = -1
    while True:
        query = _query(upgrading, tracked, last_id)
        rows = bind.execute(query.order_by(databases.c.id).limit(BATCH_SIZE)).fetchall()
        if not rows:
            break
        for row in rows:
            last_id = row.id
            extra = _load_extra(row.extra)
            uri = row.sqlalchemy_uri
            extra_text = row.extra
            if upgrading:
                # LIKE can be case-insensitive on some metadata databases.
                if not uri.startswith(LEGACY_PREFIX):
                    continue
                uri = NATIVE_PREFIX + uri[len(LEGACY_PREFIX) :]
                extra_marked = extra is not None and (
                    MARKER not in extra or extra[MARKER] is True
                )
                if extra is not None and extra_marked:
                    extra[MARKER] = True
                    extra_text = json.dumps(extra)
                # Preserve conflicting user settings instead of aborting the upgrade.
                bind.execute(records.delete().where(records.c.id == row.id))
                bind.execute(
                    records.insert().values(
                        id=row.id,
                        fingerprint=_fingerprint(uri, extra_text, row.changed_on),
                        extra_marked=extra_marked,
                    )
                )
            else:
                unchanged = row.fingerprint == _fingerprint(
                    uri, extra_text, row.changed_on
                )
                imported = (
                    row.fingerprint is None
                    and uri.startswith(NATIVE_PREFIX)
                    and extra is not None
                    and extra.get(MARKER) is True
                )
                if (unchanged or imported) and uri.startswith(NATIVE_PREFIX):
                    uri = LEGACY_PREFIX + uri[len(NATIVE_PREFIX) :]
                if (
                    (row.extra_marked or imported)
                    and extra is not None
                    and extra.get(MARKER) is True
                ):
                    del extra[MARKER]
                    extra_text = json.dumps(extra)
            bind.execute(
                databases.update()
                .where(databases.c.id == row.id)
                .values(sqlalchemy_uri=uri, extra=extra_text)
            )


def upgrade() -> None:
    """Convert legacy schemes and track the resulting rows for safe rollback."""
    create_table(
        records.name,
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("extra_marked", sa.Boolean, nullable=False),
    )
    _migrate(upgrading=True)


def downgrade() -> None:
    """Restore unchanged converted URIs, then remove migration bookkeeping."""
    _migrate(upgrading=False)
    drop_table(records.name)
