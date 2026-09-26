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
"""migrate Databricks ODBC connections to the connector driver

Part of the effort to move every Databricks connection onto the dynamic
connection form. Superset renders that form when the resolved engine spec
defines a ``parameters_schema``. The legacy ``databricks+pyodbc`` driver resolves
to ``DatabricksODBCEngineSpec``, which has no ``parameters_schema`` and therefore
only ever exposes the raw "SQLAlchemy URI" text field. The ``databricks+connector``
driver resolves to ``DatabricksNativeEngineSpec``, which does define a
``parameters_schema`` and so renders the dynamic form.

The two drivers share the same URL shape --

    databricks+<driver>://token:<access_token>@<host>:<port>/<database>

-- and both read ``http_path``, ``catalog`` and ``schema`` from
``extra.engine_params.connect_args`` rather than from the URL. Migrating a
connection is therefore a driver swap in the URL scheme; every credential and
setting (access token, host, port, database, the encryption ``ssl`` query
parameter, and the entire ``extra`` / ``encrypted_extra`` payload) is preserved
byte-for-byte. Only the scheme prefix is rewritten, so unrelated occurrences of
the driver string inside credentials or query values are left untouched.

To keep ``downgrade`` from clobbering connections a user created directly on
``databricks+connector`` (which must stay on that driver), ``upgrade`` records a
marker (``MIGRATION_MARKER``) in ``extra``. ``downgrade`` reverts only the rows
carrying that marker and removes it, so the round trip is exact and native
connector connections are never touched. The marker is an unknown key to the
``extra`` validator, which tolerates it, and is cosmetic until the connection is
next saved through the API.

Revision ID: a3f5c9e21b84
Revises: 88a01c781622
Create Date: 2026-09-15 00:00:00.000000

"""

from __future__ import annotations

from alembic import op
from sqlalchemy import Column, Integer, Text
from sqlalchemy.orm import declarative_base

from superset import db
from superset.migrations.shared.utils import paginated_update
from superset.utils import json

# revision identifiers, used by Alembic.
revision = "a3f5c9e21b84"
down_revision = "88a01c781622"

Base = declarative_base()

ODBC_PREFIX = "databricks+pyodbc"
CONNECTOR_PREFIX = "databricks+connector"

# Marker written to ``extra`` on upgrade so downgrade can revert exactly the
# rows this migration touched and leave native connector connections alone.
MIGRATION_MARKER = "migrated_from_databricks_odbc"


class Database(Base):  # type: ignore
    __tablename__ = "dbs"

    id = Column(Integer, primary_key=True)
    sqlalchemy_uri = Column(Text, nullable=False)
    extra = Column(Text)


def _swap_scheme(uri: str, old: str, new: str) -> str | None:
    """
    Rewrite only the driver in a URI's scheme, leaving the rest byte-identical.

    Returns ``None`` when the URI is not on ``old``, so callers can skip the
    write (which keeps the migration idempotent).
    """
    if not uri.startswith(f"{old}://"):
        return None
    return f"{new}{uri[len(old) :]}"


def _load_extra(extra: str | None) -> dict:
    """Parse a database's ``extra`` JSON, treating empty/absent as ``{}``."""
    if not extra:
        return {}
    loaded = json.loads(extra)
    if not isinstance(loaded, dict):
        # ``extra`` is always a JSON object in practice; anything else is
        # malformed and should not be silently wrapped or dropped.
        raise ValueError("Database.extra is not a JSON object")
    return loaded


def upgrade() -> None:
    bind = op.get_bind()
    session = db.Session(bind=bind)

    query = session.query(Database).filter(
        Database.sqlalchemy_uri.like(f"{ODBC_PREFIX}%")
    )
    for database in paginated_update(query):
        updated = _swap_scheme(database.sqlalchemy_uri, ODBC_PREFIX, CONNECTOR_PREFIX)
        if updated is None:
            continue
        database.sqlalchemy_uri = updated
        extra = _load_extra(database.extra)
        extra[MIGRATION_MARKER] = True
        database.extra = json.dumps(extra)

    session.commit()


def downgrade() -> None:
    bind = op.get_bind()
    session = db.Session(bind=bind)

    query = session.query(Database).filter(
        Database.sqlalchemy_uri.like(f"{CONNECTOR_PREFIX}%")
    )
    for database in paginated_update(query):
        extra = _load_extra(database.extra)
        if not extra.get(MIGRATION_MARKER):
            # Not migrated by us -- a natively created connector connection.
            continue
        reverted = _swap_scheme(database.sqlalchemy_uri, CONNECTOR_PREFIX, ODBC_PREFIX)
        if reverted is None:
            continue
        database.sqlalchemy_uri = reverted
        extra.pop(MIGRATION_MARKER, None)
        database.extra = json.dumps(extra) if extra else None

    session.commit()
