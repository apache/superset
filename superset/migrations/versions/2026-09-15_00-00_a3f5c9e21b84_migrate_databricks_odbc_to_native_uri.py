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
"""migrate Databricks ODBC connections to the native databricks:// URI

Part of the effort to move every Databricks connection onto the dynamic
connection form. Superset renders that form when the resolved engine spec
defines a ``parameters_schema``. The legacy ``databricks+pyodbc`` driver resolves
to ``DatabricksODBCEngineSpec``, which has no ``parameters_schema`` and therefore
only ever exposes the raw "SQLAlchemy URI" text field. The ``databricks://``
scheme resolves to ``DatabricksPythonConnectorEngineSpec``, which does define a
``parameters_schema`` and so renders the dynamic form.

This follows the conversion made by ``b8f3a2c91d64`` for legacy
``databricks+connector://`` URIs and lands ODBC connections on the same target,
rather than on the ``databricks+connector`` scheme that revision migrates away
from. As there, only the URI prefix is rewritten:

    databricks+pyodbc://token:<access_token>@<host>:<port>/<database>[?...]
    databricks://token:<access_token>@<host>:<port>/<database>[?...]

The native spec reads the URI path as the default schema and takes
``http_path``, ``catalog`` and ``schema`` from either the query string or
``extra.engine_params.connect_args``, which is where ODBC connections keep them,
so the engine-params shape carries over unchanged. Everything after the scheme
(credentials, host, port, path, query parameters) is preserved byte-for-byte;
``encrypted_extra`` and the encrypted password column are never read or written.
ODBC-only connect args such as ``driver_path`` are left in place: the Databricks
SQL connector accepts and ignores unrecognised keyword arguments.

To keep ``downgrade`` from clobbering connections created directly on
``databricks://`` (or converted by ``b8f3a2c91d64``), ``upgrade`` records a
marker (``MIGRATION_MARKER``) in ``extra`` whose value names this revision and
the id of the row it was written to. ``downgrade`` restores the original
``databricks+pyodbc`` URI only for rows on ``databricks://`` whose marker matches
exactly that revision and row id, and removes it, so the round trip is exact
and other connections are never touched -- including ones whose ``extra`` was
copied from a migrated connection, since a copy lives under a different row id.
The marker is an unknown key to the ``extra`` validator, which tolerates it, and
is cosmetic until the connection is next saved through the API.

A row whose ``extra`` is not a valid JSON object is logged and skipped in both
directions rather than aborting the run. ``paginated_update`` commits per
batch, and each migrated row receives its new URI and marker together, so a
run that stops partway leaves every row either fully migrated or untouched and
is safe to re-run.

Revision ID: a3f5c9e21b84
Revises: b8f3a2c91d64
Create Date: 2026-09-15 00:00:00.000000

"""

from __future__ import annotations

import logging
from typing import Any

from alembic import op
from sqlalchemy import Column, Integer, Text
from sqlalchemy.orm import declarative_base

from superset import db
from superset.migrations.shared.utils import paginated_update
from superset.utils import json

# revision identifiers, used by Alembic.
revision = "a3f5c9e21b84"
down_revision = "b8f3a2c91d64"

logger = logging.getLogger("alembic.env")

Base = declarative_base()

ODBC_SCHEME = "databricks+pyodbc"
NATIVE_SCHEME = "databricks"

# Marker written to ``extra`` on upgrade so downgrade can revert exactly the
# rows this migration touched and leave every other databricks:// connection
# alone. Its value is produced by ``_marker_value`` and is bound to a row.
MIGRATION_MARKER = "migrated_from_databricks_odbc"


class Database(Base):  # type: ignore
    __tablename__ = "dbs"

    id = Column(Integer, primary_key=True)
    sqlalchemy_uri = Column(Text, nullable=False)
    extra = Column(Text)


def _swap_scheme(uri: str, old: str, new: str) -> str | None:
    """
    Rewrite only a URI's scheme, leaving the rest byte-identical.

    Returns ``None`` when the URI is not on ``old`` (compared case-sensitively,
    since ``LIKE`` is case-insensitive on some metadata databases), so callers
    can skip the write, which keeps the migration idempotent.
    """
    if not uri.startswith(f"{old}://"):
        return None
    return f"{new}{uri[len(old) :]}"


def _load_extra(extra: str | None) -> dict[str, Any]:
    """Parse a database's ``extra`` JSON, treating empty/absent as ``{}``."""
    if not extra:
        return {}
    loaded = json.loads(extra)
    if not isinstance(loaded, dict):
        # ``extra`` is always a JSON object in practice; anything else is
        # malformed and should not be silently wrapped or dropped.
        raise ValueError("Database.extra is not a JSON object")
    return loaded


def _marker_value(database: Database) -> dict[str, Any]:
    """The marker value identifying ``database`` as migrated by this revision."""
    return {"revision": revision, "database_id": database.id}


def _safe_load_extra(database: Database) -> dict[str, Any] | None:
    """
    Parse ``database.extra``, logging and returning ``None`` when it is
    malformed so the caller can skip the row instead of aborting the run.
    """
    try:
        return _load_extra(database.extra)
    except ValueError:
        logger.warning(
            "Skipping database id=%s: extra is not a valid JSON object",
            database.id,
        )
        return None


def upgrade() -> None:
    bind = op.get_bind()
    session = db.Session(bind=bind)

    query = session.query(Database).filter(
        Database.sqlalchemy_uri.like(f"{ODBC_SCHEME}://%")
    )
    for database in paginated_update(query):
        updated = _swap_scheme(database.sqlalchemy_uri, ODBC_SCHEME, NATIVE_SCHEME)
        if updated is None:
            continue
        extra = _safe_load_extra(database)
        if extra is None:
            continue
        extra[MIGRATION_MARKER] = _marker_value(database)
        database.sqlalchemy_uri = updated
        database.extra = json.dumps(extra)

    session.commit()


def downgrade() -> None:
    bind = op.get_bind()
    session = db.Session(bind=bind)

    query = session.query(Database).filter(
        Database.sqlalchemy_uri.like(f"{NATIVE_SCHEME}://%")
    )
    for database in paginated_update(query):
        extra = _safe_load_extra(database)
        if extra is None or extra.get(MIGRATION_MARKER) != _marker_value(database):
            # Not migrated by this revision for this row -- a natively created
            # or otherwise converted connection, or one whose ``extra`` was
            # copied from a migrated connection.
            continue
        reverted = _swap_scheme(database.sqlalchemy_uri, NATIVE_SCHEME, ODBC_SCHEME)
        if reverted is None:
            continue
        database.sqlalchemy_uri = reverted
        extra.pop(MIGRATION_MARKER, None)
        database.extra = json.dumps(extra) if extra else None

    session.commit()
