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

The backend name selects the engine spec (``Database.db_engine_spec`` reads
``url.get_backend_name()``), so saved legacy URIs are rewritten from
``clickhouse[+driver]://`` to ``clickhousedb+connect://``. Only rows whose
meaning can be carried across exactly are rewritten; everything else is left on
the legacy driver -- which keeps working -- and logged by id for an operator.

HTTP driver (``clickhouse://``, ``clickhouse+http://``)
-------------------------------------------------------

``clickhouse-sqlalchemy`` builds the server URL as
``f"{protocol}://{host}:{url.port or 8123}/{endpoint}"``: TLS comes only from
``?protocol=https``, the port defaults to 8123 whatever the protocol, and
``secure`` is not read at all. ``clickhouse-connect`` reads ``secure`` instead
and defaults a TLS connection to 8443. So:

* ``protocol=https`` becomes ``secure=true``; ``protocol=http`` is dropped.
* a stray ``secure`` is dropped -- the legacy driver ignored it, so keeping it
  would switch a plaintext connection to TLS (or, alongside ``protocol=https``,
  produce a duplicate whose last value wins).
* when the rewrite introduces ``secure=true`` and the URI has no port, 8123 is
  pinned so the connection keeps addressing the same interface.
* ``verify=true|false`` has the same meaning in both drivers and is kept.

Native driver (``clickhouse+native://``, ``clickhouse+asynch://``)
------------------------------------------------------------------

``clickhouse-connect`` is HTTP-only, so a native connection also has to move to
the HTTP interface. The native default port (9000, or no port, which implies
9000) becomes the HTTP default 8123. A falsy ``secure`` is dropped.

Rows left on the legacy driver
------------------------------

* any query parameter other than the ones above -- the drivers do not share a
  vocabulary (e.g. the legacy ``endpoint`` is the HTTP request path, while
  ``clickhouse-connect`` forwards unknown keys as server settings and rejects
  unrecognised ones), so carrying them over verbatim would silently change or
  break the connection;
* ``verify`` with a non-boolean value (a CA bundle path);
* a non-default native port, or native TLS (``secure=true``), neither of which
  maps to a known HTTP port without the server's configuration;
* a rewritten URI that would overflow the ``dbs.sqlalchemy_uri`` column.

Operators should confirm the HTTP interface is reachable for rewritten native
connections.

Credentials live in the separately encrypted ``password`` column (the URI only
carries the masked placeholder), which this migration never reads or writes;
``encrypted_extra`` is untouched too.

Rollback
--------

The rewrite is not textually reversible (parameters are translated and native
ports change), and afterwards a migrated row looks like any connection created
on the ``clickhousedb`` key. ``upgrade`` therefore records each rewritten row's
original URI and a fingerprint of its migrated state in a migration-owned
table. ``downgrade`` restores the original only for rows whose fingerprint still
matches -- connections edited since the upgrade, and connections created on the
``clickhousedb`` key, are left alone -- and then drops the table.

Revision ID: f7b3a9c14e02
Revises: b8f3a2c91d64
Create Date: 2026-09-15 00:00:00.000000

"""

from __future__ import annotations

import logging
from datetime import datetime
from hashlib import sha256

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared.utils import create_table, drop_table
from superset.utils import json

logger = logging.getLogger("alembic.env")

# revision identifiers, used by Alembic.
revision = "f7b3a9c14e02"
down_revision = "b8f3a2c91d64"

LEGACY_BACKEND = "clickhouse"
TARGET_SCHEME = "clickhousedb+connect"

# Drivers that use the native TCP protocol rather than HTTP.
NATIVE_DRIVERS = {"native", "asynch"}
HTTP_DRIVERS = {"", "http"}
NATIVE_DEFAULT_PORT = "9000"
HTTP_DEFAULT_PORT = "8123"

# Matches the String(1024) length of dbs.sqlalchemy_uri; the rewrite lengthens
# the scheme (and may add a port), so a row near the limit could overflow.
URI_MAX_LENGTH = 1024
BATCH_SIZE = 1000

_TRUE = {"true", "1", "yes", "y", "on", "t"}
_FALSE = {"false", "0", "no", "n", "off", "f", ""}

# Deliberately independent of application models and encrypted column types.
databases = sa.table(
    "dbs",
    sa.column("id", sa.Integer),
    sa.column("sqlalchemy_uri", sa.String(1024)),
    sa.column("changed_on", sa.DateTime),
)

records = sa.table(
    "clickhouse_uri_migration",
    sa.column("id", sa.Integer),
    sa.column("original_uri", sa.String(1024)),
    sa.column("fingerprint", sa.String(64)),
)


class UnconvertibleError(Exception):
    """A legacy row that cannot be rewritten without changing its meaning."""


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
    at = authority.rfind("@")
    path, _, query = remainder[end:].partition("?")
    return authority[: at + 1], authority[at + 1 :], path, query


def _split_hostport(hostport: str) -> tuple[str, str | None]:
    """Split ``host[:port]``, treating a bracketed IPv6 literal as one host."""
    if hostport.startswith("["):
        close = hostport.find("]")
        rest = hostport[close + 1 :]
        if close == -1 or (rest and not rest.startswith(":")):
            raise UnconvertibleError("unparseable IPv6 host")
        return hostport[: close + 1], rest[1:] if rest else None
    host, colon, port = hostport.rpartition(":")
    return (host, port) if colon else (hostport, None)


def _rewrite_query(query: str, native: bool) -> tuple[list[str], bool]:
    """Translate the query string; return the new pairs and whether TLS is on."""
    pairs: list[str] = []
    secure = False
    for pair in query.split("&") if query else []:
        key, _, value = pair.partition("=")
        lowered = value.lower()
        if key == "protocol" and not native:
            if lowered not in {"http", "https"}:
                raise UnconvertibleError(f"unsupported protocol {value!r}")
            if lowered == "https" and not secure:
                # Takes the position of the protocol flag it replaces.
                secure = True
                pairs.append("secure=true")
        elif key == "secure":
            if native and lowered not in _FALSE:
                raise UnconvertibleError("native TLS has no known HTTP port")
            # The legacy HTTP driver ignores ``secure``; TLS comes from protocol.
        elif key == "verify" and not native and lowered in _TRUE | _FALSE:
            pairs.append(pair)
        else:
            raise UnconvertibleError(
                f"parameter {key!r} has no clickhouse-connect equivalent"
            )
    return pairs, secure


def _rewrite(uri: str) -> str | None:
    """Return the migrated URI, ``None`` for a non-legacy row, or raise."""
    scheme, separator, remainder = uri.partition("://")
    backend, _, driver = scheme.partition("+")
    if not separator or backend != LEGACY_BACKEND:
        # Already clickhousedb, or an unrelated engine.
        return None
    if driver not in NATIVE_DRIVERS | HTTP_DRIVERS:
        raise UnconvertibleError(f"unknown driver {driver!r}")

    native = driver in NATIVE_DRIVERS
    userinfo, hostport, path, query = _split_uri(remainder)
    host, port = _split_hostport(hostport)
    pairs, secure = _rewrite_query(query, native)

    if native:
        if port not in (None, NATIVE_DEFAULT_PORT):
            raise UnconvertibleError(f"non-default native port {port}")
        port = HTTP_DEFAULT_PORT
    elif port is None and secure:
        # clickhouse-connect would default a TLS connection to 8443, but the
        # legacy driver always defaulted to 8123.
        port = HTTP_DEFAULT_PORT

    migrated = f"{TARGET_SCHEME}://{userinfo}{host}"
    if port is not None:
        migrated = f"{migrated}:{port}"
    migrated = f"{migrated}{path}"
    if pairs:
        migrated = f"{migrated}?{'&'.join(pairs)}"

    if len(migrated) > URI_MAX_LENGTH:
        raise UnconvertibleError(
            f"migrated URI would exceed {URI_MAX_LENGTH} characters"
        )
    return migrated


def _migrate_uri(uri: str) -> str | None:
    """Return the migrated URI, or ``None`` when the row is left untouched."""
    try:
        return _rewrite(uri)
    except UnconvertibleError:
        return None


def _fingerprint(uri: str, changed_on: datetime | None) -> str:
    """Recognize the migrated state, including later edits to the connection."""
    return sha256(json.dumps([uri, str(changed_on)]).encode("utf-8")).hexdigest()


def upgrade() -> None:
    """Rewrite legacy URIs and record each converted row for exact rollback."""
    create_table(
        records.name,
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=False),
        sa.Column("original_uri", sa.String(1024), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
    )
    bind = op.get_bind()
    last_id = -1
    while True:
        # Keyset batches, so rewriting rows out of the LIKE cannot skip others.
        rows = bind.execute(
            sa.select(databases)
            .where(
                databases.c.id > last_id,
                databases.c.sqlalchemy_uri.like(f"{LEGACY_BACKEND}%"),
            )
            .order_by(databases.c.id)
            .limit(BATCH_SIZE)
        ).fetchall()
        if not rows:
            break
        for row in rows:
            last_id = row.id
            try:
                migrated = _rewrite(row.sqlalchemy_uri)
            except UnconvertibleError as ex:
                logger.warning(
                    "Leaving ClickHouse database id=%s on the legacy clickhouse "
                    "driver (%s); migrate it to clickhousedb manually.",
                    row.id,
                    ex,
                )
                continue
            if migrated is None:
                continue
            updated = bind.execute(
                databases.update()
                .where(
                    databases.c.id == row.id,
                    databases.c.sqlalchemy_uri == row.sqlalchemy_uri,
                )
                .values(sqlalchemy_uri=migrated)
            )
            if updated.rowcount:
                bind.execute(records.delete().where(records.c.id == row.id))
                bind.execute(
                    records.insert().values(
                        id=row.id,
                        original_uri=row.sqlalchemy_uri,
                        fingerprint=_fingerprint(migrated, row.changed_on),
                    )
                )


def downgrade() -> None:
    """Restore unchanged converted URIs, then remove migration bookkeeping."""
    bind = op.get_bind()
    rows = bind.execute(
        sa.select(
            databases.c.id,
            databases.c.sqlalchemy_uri,
            databases.c.changed_on,
            records.c.original_uri,
            records.c.fingerprint,
        ).select_from(records.join(databases, databases.c.id == records.c.id))
    ).fetchall()
    for row in rows:
        if row.fingerprint != _fingerprint(row.sqlalchemy_uri, row.changed_on):
            logger.warning(
                "Not reverting ClickHouse database id=%s: it changed after the "
                "upgrade.",
                row.id,
            )
            continue
        bind.execute(
            databases.update()
            .where(
                databases.c.id == row.id,
                databases.c.sqlalchemy_uri == row.sqlalchemy_uri,
            )
            .values(sqlalchemy_uri=row.original_uri)
        )
    drop_table(records.name)
