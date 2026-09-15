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
"""migrate legacy ClickHouse connections onto the clickhouse-connect driver

Superset ships two ClickHouse engine specs. ``ClickHouseEngineSpec`` (backend
``clickhouse``, the ``clickhouse-sqlalchemy`` driver) is the legacy spec and has
no dynamic parameters schema, so its connections still render the free-form
SQLAlchemy URI editor. ``ClickHouseConnectEngineSpec`` (backend ``clickhousedb``,
default driver ``connect``, the ``clickhouse-connect`` driver) defines a
``parameters_schema`` and therefore renders the new dynamic connection form.

This migration rewrites the ``sqlalchemy_uri`` of connections stored on the
legacy ``clickhouse`` backend so they resolve to ``ClickHouseConnectEngineSpec``
and expose the new form. The backend name is what selects the engine spec
(``Database.db_engine_spec`` reads ``url.get_backend_name()``), so the scheme is
rewritten from ``clickhouse[+driver]://`` to ``clickhousedb+connect://``.

Scheme and port mapping
-----------------------

* ``clickhouse://`` and ``clickhouse+http://`` -- the ``clickhouse-sqlalchemy``
  HTTP dialect, default port 8123. ``clickhouse-connect`` also speaks HTTP on
  8123, so only the scheme changes; host, port, credentials, database and query
  string are preserved byte-for-byte.
* ``clickhouse+native://`` and ``clickhouse+asynch://`` -- the native TCP
  protocol, default port 9000. ``clickhouse-connect`` cannot speak the native
  protocol; it is HTTP-only. A native connection therefore also needs its port
  moved to the HTTP interface. When the port is the native default (9000, or
  absent -- which implies 9000) it is rewritten to the HTTP default (8123).
  A *non-default* native port cannot be mapped to an HTTP port without knowing
  the server's configuration, so those rows are left on the legacy driver for a
  human to migrate rather than pointed at a guessed port. Operators should
  confirm the HTTP interface is enabled on the rewritten native connections.

Password handling: the credential lives either inline in the URI or in
``encrypted_extra``; both are preserved because the URI is edited in place (only
the scheme, and for native rows the port, are touched) and ``encrypted_extra``
is never read.

Only rows whose backend is exactly ``clickhouse`` are rewritten; rows already on
``clickhousedb`` are skipped, which also makes ``upgrade`` idempotent.

Downgrade
---------

``downgrade`` is intentionally a no-op. After ``upgrade`` a migrated row is
byte-for-byte indistinguishable from a connection an operator created directly on
the ``clickhousedb`` key (both are produced by ``build_sqlalchemy_uri`` as
``clickhousedb+connect://...``), so a blind reversal would also revert genuine
``clickhousedb`` connections onto the legacy driver and break them. The migrated
connections keep working after a code rollback regardless, because
``ClickHouseConnectEngineSpec`` predates this migration -- no data restoration is
required for them to remain functional -- so the safe choice is to leave the
rewritten URIs in place.

The revision tree had two open heads when this was authored -- ``88a01c781622``
(``index_ab_user_lower_username``) and ``c7f53d184ea2``
(``coordinate_purge_audit_pruning``), which forked at ``7e2c9a4f1b83``. This
revision merges them so the tree keeps a single head; the data rewrite itself is
independent of both branches.

Revision ID: f7b3a9c14e02
Revises: 88a01c781622, c7f53d184ea2
Create Date: 2026-09-15 00:00:00.000000

"""

from alembic import op
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base

from superset import db
from superset.migrations.shared.utils import paginated_update

# revision identifiers, used by Alembic.
revision = "f7b3a9c14e02"
down_revision = ("88a01c781622", "c7f53d184ea2")

Base = declarative_base()

LEGACY_BACKEND = "clickhouse"
TARGET_SCHEME = "clickhousedb+connect"

# Drivers that use the native TCP protocol rather than HTTP.
NATIVE_DRIVERS = {"native", "asynch"}
NATIVE_DEFAULT_PORT = "9000"
HTTP_DEFAULT_PORT = "8123"


class Database(Base):  # type: ignore
    __tablename__ = "dbs"

    id = Column(Integer, primary_key=True)
    sqlalchemy_uri = Column(String(1024), nullable=False)


def _swap_native_default_port(remainder: str) -> str | None:
    """Move a native-default port onto the HTTP interface.

    ``remainder`` is everything after ``://`` -- ``userinfo@host[:port][/path]
    [?query]``. Returns the remainder with the port rewritten to the HTTP
    default when it is the native default (9000) or absent (which implies 9000),
    and ``None`` when the port is a non-default native port or an IPv6 literal
    host is present, so the caller can leave those rows on the legacy driver
    rather than guess an HTTP port.
    """
    # Credentials are not escaped for "@", so the host section starts after the
    # last one.
    host_start = remainder.rfind("@") + 1

    # The authority ends at the path or query, whichever comes first.
    end = len(remainder)
    for index in range(host_start, len(remainder)):
        if remainder[index] in "/?":
            end = index
            break

    authority = remainder[host_start:end]
    if authority.startswith("["):
        # IPv6 literal host -- the "host:port" split below is unsafe here.
        return None

    host, colon, port = authority.rpartition(":")
    if not colon:
        # No explicit port: the native driver defaults to 9000, so pin the HTTP
        # port explicitly for clickhouse-connect.
        new_authority = f"{authority}:{HTTP_DEFAULT_PORT}"
    elif port == NATIVE_DEFAULT_PORT:
        new_authority = f"{host}:{HTTP_DEFAULT_PORT}"
    else:
        return None

    return remainder[:host_start] + new_authority + remainder[end:]


def _migrate_uri(uri: str) -> str | None:
    """Rewrite a legacy ``clickhouse`` URI onto ``clickhousedb+connect``.

    Returns ``None`` when the URI should be left untouched (already on the
    ``clickhousedb`` backend, malformed, or a native connection whose port
    cannot be mapped to the HTTP interface).
    """
    scheme, separator, remainder = uri.partition("://")
    if not separator:
        return None

    backend, _, driver = scheme.partition("+")
    if backend != LEGACY_BACKEND:
        # Already clickhousedb, or an unrelated engine.
        return None

    if driver in NATIVE_DRIVERS:
        remapped = _swap_native_default_port(remainder)
        if remapped is None:
            return None
        remainder = remapped

    return f"{TARGET_SCHEME}://{remainder}"


def upgrade() -> None:
    bind = op.get_bind()
    session = db.Session(bind=bind)

    # The LIKE also matches "clickhousedb%"; _migrate_uri filters those out by
    # backend name, so re-running is a no-op.
    query = session.query(Database).filter(Database.sqlalchemy_uri.like("clickhouse%"))
    for database in paginated_update(query):
        updated = _migrate_uri(database.sqlalchemy_uri)
        if updated:
            database.sqlalchemy_uri = updated

    session.commit()


def downgrade() -> None:
    # Intentionally a no-op; see the module docstring. A migrated row is
    # indistinguishable from a natively-created clickhousedb connection, and the
    # rewritten URIs remain functional after a code rollback, so nothing is
    # reverted.
    pass
