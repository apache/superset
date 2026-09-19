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

TLS: ``clickhouse-sqlalchemy`` enables TLS with ``?protocol=https``, but
``clickhouse-connect`` ignores ``protocol`` and reads ``secure`` instead, so a
preserved ``protocol=https`` would silently downgrade an encrypted connection to
plaintext HTTP. ``protocol=https`` is therefore rewritten to ``secure=true`` and
the meaningless ``protocol`` parameter is dropped; ``secure`` values that a
connection already carries are left untouched.

Password handling: the credential lives either inline in the URI or in
``encrypted_extra``; both are preserved because the URI is edited in place (only
the scheme, the TLS parameter, and for native rows the port, are touched) and
``encrypted_extra`` is never read.

Only rows whose backend is exactly ``clickhouse`` are rewritten; rows already on
``clickhousedb`` are skipped, which also makes ``upgrade`` idempotent. A row
whose rewritten URI would exceed the ``dbs.sqlalchemy_uri`` column length is
skipped with a warning rather than truncated.

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

import logging

from alembic import op
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base

from superset import db
from superset.migrations.shared.utils import paginated_update

logger = logging.getLogger("alembic")

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

# Matches the String(1024) length of dbs.sqlalchemy_uri; the rewrite lengthens
# the scheme (and may add a port), so a row near the limit could overflow.
URI_MAX_LENGTH = 1024


class Database(Base):  # type: ignore
    __tablename__ = "dbs"

    id = Column(Integer, primary_key=True)
    sqlalchemy_uri = Column(String(1024), nullable=False)


def _split_uri(remainder: str) -> tuple[str, str, str, str]:
    """Split the part after ``://`` into userinfo, host:port, path and query.

    ``remainder`` is ``[userinfo@]host[:port][/path][?query]``. The authority
    (userinfo + host) is delimited by the first ``/`` or ``?``, and the
    credential separator is the last ``@`` *within* that authority -- searching
    the whole string would let an ``@`` in the path or query be mistaken for it.
    ``userinfo`` retains its trailing ``@`` (empty when there are no
    credentials) so the pieces concatenate back losslessly.
    """
    end = len(remainder)
    for index, char in enumerate(remainder):
        if char in "/?":
            end = index
            break

    authority = remainder[:end]
    rest = remainder[end:]

    at = authority.rfind("@")
    userinfo = authority[: at + 1]
    hostport = authority[at + 1 :]

    path, _, query = rest.partition("?")
    return userinfo, hostport, path, query


def _remap_native_port(hostport: str) -> str | None:
    """Move a native-default port onto the HTTP interface.

    Returns ``hostport`` with the port rewritten to the HTTP default when it is
    the native default (9000) or absent (which implies 9000), and ``None`` when
    the port is a non-default native port or an IPv6 literal host is present, so
    the caller can leave those rows on the legacy driver rather than guess an
    HTTP port.
    """
    if hostport.startswith("["):
        # IPv6 literal host -- the "host:port" split below is unsafe here.
        return None

    host, colon, port = hostport.rpartition(":")
    if not colon:
        # No explicit port: the native driver defaults to 9000, so pin the HTTP
        # port explicitly for clickhouse-connect.
        return f"{hostport}:{HTTP_DEFAULT_PORT}"
    if port == NATIVE_DEFAULT_PORT:
        return f"{host}:{HTTP_DEFAULT_PORT}"
    return None


def _migrate_query(query: str) -> str:
    """Translate the legacy ``protocol`` TLS flag to clickhouse-connect's.

    ``clickhouse-sqlalchemy`` selects TLS with ``?protocol=https``;
    ``clickhouse-connect`` ignores ``protocol`` and reads ``secure`` instead, so
    a preserved ``protocol=https`` would silently downgrade an encrypted
    connection to plaintext HTTP. ``protocol=https`` becomes ``secure=true`` and
    the now-meaningless ``protocol`` parameter is dropped; every other parameter
    keeps its position and value.
    """
    if not query:
        return query

    rewritten = []
    for pair in query.split("&"):
        key, _, value = pair.partition("=")
        if key == "protocol":
            if value.lower() == "https":
                rewritten.append("secure=true")
            # protocol=http (the plaintext default) carries no meaning for
            # clickhouse-connect and is dropped.
            continue
        rewritten.append(pair)
    return "&".join(rewritten)


def _migrate_uri(uri: str) -> str | None:
    """Rewrite a legacy ``clickhouse`` URI onto ``clickhousedb+connect``.

    Returns ``None`` when the URI should be left untouched (already on the
    ``clickhousedb`` backend, malformed, a native connection whose port cannot
    be mapped to the HTTP interface, or one that would overflow the column).
    """
    scheme, separator, remainder = uri.partition("://")
    if not separator:
        return None

    backend, _, driver = scheme.partition("+")
    if backend != LEGACY_BACKEND:
        # Already clickhousedb, or an unrelated engine.
        return None

    userinfo, hostport, path, query = _split_uri(remainder)

    if driver in NATIVE_DRIVERS:
        remapped = _remap_native_port(hostport)
        if remapped is None:
            return None
        hostport = remapped

    query = _migrate_query(query)

    migrated = f"{TARGET_SCHEME}://{userinfo}{hostport}{path}"
    if query:
        migrated = f"{migrated}?{query}"

    if len(migrated) > URI_MAX_LENGTH:
        logger.warning(
            "Skipping ClickHouse connection whose migrated URI exceeds the "
            "%d-character dbs.sqlalchemy_uri limit; migrate it manually.",
            URI_MAX_LENGTH,
        )
        return None

    return migrated


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
