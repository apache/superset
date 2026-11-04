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
"""Tests for migration ``f7b3a9c14e02_migrate_clickhouse_to_clickhousedb``."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime
from importlib import import_module
from unittest.mock import patch

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy.engine import Engine

migration = import_module(
    "superset.migrations.versions."
    "2026-09-15_00-00_f7b3a9c14e02_migrate_clickhouse_to_clickhousedb"
)
_migrate_uri = migration._migrate_uri

# Superset stores the password as this mask rather than the real credential
MASK = "X" * 10
CHANGED_ON = datetime(2026, 1, 1)


@pytest.fixture
def engine() -> Iterator[Engine]:
    engine = sa.create_engine("sqlite://")
    metadata = sa.MetaData()
    sa.Table(
        "dbs",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("sqlalchemy_uri", sa.String(1024)),
        sa.Column("changed_on", sa.DateTime),
    )
    metadata.create_all(engine)
    yield engine
    engine.dispose()


def _seed(engine: Engine, uris: dict[int, str]) -> None:
    with engine.begin() as conn:
        conn.execute(
            migration.databases.insert(),
            [
                {"id": id_, "sqlalchemy_uri": uri, "changed_on": CHANGED_ON}
                for id_, uri in uris.items()
            ],
        )


def _uris(engine: Engine) -> dict[int, str]:
    with engine.connect() as conn:
        return dict(
            conn.execute(
                sa.select(
                    migration.databases.c.id, migration.databases.c.sqlalchemy_uri
                )
            ).fetchall()
        )


def _run(engine: Engine, upgrading: bool) -> None:
    """Execute with real Alembic operations and deliberately small batches."""
    with engine.begin() as conn, patch.object(migration, "BATCH_SIZE", 2):
        with Operations.context(MigrationContext.configure(conn)):
            (migration.upgrade if upgrading else migration.downgrade)()


@pytest.mark.parametrize(
    "uri,expected",
    [
        # HTTP driver: only the scheme changes
        (
            f"clickhouse://user:{MASK}@host:8123/db",
            f"clickhousedb+connect://user:{MASK}@host:8123/db",
        ),
        (
            f"clickhouse+http://user:{MASK}@host:8123/db",
            f"clickhousedb+connect://user:{MASK}@host:8123/db",
        ),
        # no port and no TLS: both drivers default to 8123, so none is added
        ("clickhouse://localhost/default", "clickhousedb+connect://localhost/default"),
        # verify has the same meaning in both drivers
        (
            f"clickhouse://user:{MASK}@host:8443/db?protocol=https&verify=false",
            f"clickhousedb+connect://user:{MASK}@host:8443/db?secure=true&verify=false",
        ),
        # an "@" in the credentials is not the separator
        (
            "clickhouse+native://user:p@ss@host:9000/db",
            "clickhousedb+connect://user:p@ss@host:8123/db",
        ),
        # IPv6 literal hosts keep their brackets
        ("clickhouse://[::1]:8123/db", "clickhousedb+connect://[::1]:8123/db"),
        ("clickhouse+native://[::1]/db", "clickhousedb+connect://[::1]:8123/db"),
    ],
)
def test_migrate_uri_http(uri: str, expected: str) -> None:
    assert _migrate_uri(uri) == expected


@pytest.mark.parametrize(
    "uri,expected",
    [
        # legacy TLS flag becomes clickhouse-connect's secure
        (
            f"clickhouse://user:{MASK}@host:8443/db?protocol=https",
            f"clickhousedb+connect://user:{MASK}@host:8443/db?secure=true",
        ),
        # without a port the legacy driver used 8123 even for https, while
        # clickhouse-connect would pick 8443 for secure=true, so 8123 is pinned
        (
            f"clickhouse://user:{MASK}@host/db?protocol=https",
            f"clickhousedb+connect://user:{MASK}@host:8123/db?secure=true",
        ),
        # protocol=http is the plaintext default and is dropped
        (
            f"clickhouse://user:{MASK}@host:8123/db?protocol=http",
            f"clickhousedb+connect://user:{MASK}@host:8123/db",
        ),
        # the legacy HTTP driver ignored secure, so it must not turn TLS on...
        (
            f"clickhouse://user:{MASK}@host:8123/db?secure=true",
            f"clickhousedb+connect://user:{MASK}@host:8123/db",
        ),
        # ...nor leave a conflicting duplicate next to the translated flag
        (
            f"clickhouse://user:{MASK}@host:8443/db?secure=false&protocol=https",
            f"clickhousedb+connect://user:{MASK}@host:8443/db?secure=true",
        ),
        # the translated flag keeps the position of the one it replaces
        (
            "clickhouse://host:8443/db?verify=true&protocol=https&verify=true",
            "clickhousedb+connect://host:8443/db?verify=true&secure=true&verify=true",
        ),
    ],
)
def test_migrate_uri_translates_tls(uri: str, expected: str) -> None:
    assert _migrate_uri(uri) == expected


@pytest.mark.parametrize(
    "uri,expected",
    [
        # native default port 9000 moves to the HTTP interface (8123)
        (
            f"clickhouse+native://user:{MASK}@host:9000/db",
            f"clickhousedb+connect://user:{MASK}@host:8123/db",
        ),
        (
            f"clickhouse+asynch://user:{MASK}@host:9000/db",
            f"clickhousedb+connect://user:{MASK}@host:8123/db",
        ),
        # no explicit port implies the native default 9000
        (
            f"clickhouse+native://user:{MASK}@host/db",
            f"clickhousedb+connect://user:{MASK}@host:8123/db",
        ),
        # a falsy secure is plaintext in both drivers and is dropped
        (
            "clickhouse+native://host:9000/db?secure=false",
            "clickhousedb+connect://host:8123/db",
        ),
    ],
)
def test_migrate_uri_native(uri: str, expected: str) -> None:
    assert _migrate_uri(uri) == expected


@pytest.mark.parametrize(
    "uri",
    [
        # already on the clickhousedb backend, or another engine
        f"clickhousedb+connect://user:{MASK}@host:8123/db",
        f"clickhousedb://user:{MASK}@host:8443/db?secure=true",
        f"postgresql://user:{MASK}@host:5432/db",
        "clickhouse-not-a-uri",
        # a non-default native port has no known HTTP equivalent
        f"clickhouse+native://user:{MASK}@host:9440/db",
        # native TLS has no known HTTP port either
        "clickhouse+native://host:9000/db?secure=true",
        # parameters the drivers don't share are not carried over silently
        "clickhouse://host:8123/db?endpoint=clickhouse",
        "clickhouse://host:8123/db?timeout=30",
        "clickhouse://host:8443/db?protocol=https&ca_certs=/etc/ca.pem",
        "clickhouse://host:8443/db?protocol=https&verify=/etc/ca.pem",
        "clickhouse+native://host:9000/db?compression=lz4",
        "clickhouse://host:8123/db?protocol=ftp",
        # an unknown driver
        "clickhouse+mystery://host:8123/db",
    ],
)
def test_migrate_uri_leaves_row_alone(uri: str) -> None:
    assert _migrate_uri(uri) is None


def test_migrate_uri_ignores_at_sign_in_query() -> None:
    """An "@" after the authority must not be mistaken for the separator."""
    assert (
        _migrate_uri("clickhouse+native://host:9000/db@x")
        == "clickhousedb+connect://host:8123/db@x"
    )


def test_migrate_uri_skips_rows_that_would_overflow_the_column() -> None:
    padding = "x" * (migration.URI_MAX_LENGTH - len("clickhouse://host/"))
    uri = f"clickhouse://host/{padding}"
    assert len(uri) == migration.URI_MAX_LENGTH
    assert _migrate_uri(uri) is None


def test_upgrade_rewrites_only_convertible_rows(engine: Engine, caplog) -> None:
    _seed(
        engine,
        {
            1: f"clickhouse://user:{MASK}@host:8123/db",
            2: f"clickhouse+native://user:{MASK}@host:9000/db",
            3: f"clickhouse+native://user:{MASK}@host:9440/db",
            4: f"clickhousedb+connect://user:{MASK}@host:8123/db",
            5: f"postgresql://user:{MASK}@host:5432/db",
            6: "clickhouse://host:8123/db?endpoint=proxy",
        },
    )

    _run(engine, upgrading=True)

    assert _uris(engine) == {
        1: f"clickhousedb+connect://user:{MASK}@host:8123/db",
        2: f"clickhousedb+connect://user:{MASK}@host:8123/db",
        3: f"clickhouse+native://user:{MASK}@host:9440/db",
        4: f"clickhousedb+connect://user:{MASK}@host:8123/db",
        5: f"postgresql://user:{MASK}@host:5432/db",
        6: "clickhouse://host:8123/db?endpoint=proxy",
    }
    # skipped rows reach the operator by id
    assert "id=3" in caplog.text
    assert "id=6" in caplog.text


def test_upgrade_is_idempotent(engine: Engine) -> None:
    _seed(engine, {1: f"clickhouse://user:{MASK}@host:8123/db"})

    _run(engine, upgrading=True)
    _run(engine, upgrading=True)

    assert _uris(engine) == {1: f"clickhousedb+connect://user:{MASK}@host:8123/db"}


def test_round_trip_restores_original_uris(engine: Engine) -> None:
    original = {
        1: f"clickhouse://user:{MASK}@host/db?protocol=https&verify=false",
        2: f"clickhouse+native://user:{MASK}@host/db?secure=false",
        3: f"clickhouse+native://user:{MASK}@host:9440/db",
    }
    _seed(engine, original)

    _run(engine, upgrading=True)
    _run(engine, upgrading=False)

    assert _uris(engine) == original
    assert not sa.inspect(engine).has_table(migration.records.name)


def test_downgrade_leaves_native_and_edited_connections(engine: Engine) -> None:
    """Rows created on clickhousedb, or edited after the upgrade, stay put."""
    _seed(
        engine,
        {
            1: f"clickhouse://user:{MASK}@host:8123/db",
            2: f"clickhouse://user:{MASK}@host:8123/db",
            3: f"clickhousedb+connect://user:{MASK}@host:8123/db",
        },
    )
    _run(engine, upgrading=True)
    with engine.begin() as conn:
        conn.execute(
            migration.databases.update()
            .where(migration.databases.c.id == 2)
            .values(changed_on=datetime(2026, 2, 1))
        )

    _run(engine, upgrading=False)

    assert _uris(engine) == {
        1: f"clickhouse://user:{MASK}@host:8123/db",
        2: f"clickhousedb+connect://user:{MASK}@host:8123/db",
        3: f"clickhousedb+connect://user:{MASK}@host:8123/db",
    }
