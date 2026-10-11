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
"""Tests for migration ``f7b3a9c14e02_migrate_clickhouse_to_clickhousedb``.

Covers the URI rewrite helper (HTTP and native drivers, port mapping, rows that
must be skipped), the full upgrade() path over a mixture of connections, and the
no-op downgrade().
"""

from __future__ import annotations

from importlib import import_module
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

migration = import_module(
    "superset.migrations.versions."
    "2026-09-15_00-00_f7b3a9c14e02_migrate_clickhouse_to_clickhousedb"
)

Database = migration.Database
_migrate_uri = migration._migrate_uri

# Superset stores the password as this mask rather than the real credential
MASK = "X" * 10


@pytest.fixture
def engine():
    engine = create_engine("sqlite:///:memory:")
    migration.Base.metadata.create_all(engine)
    return engine


def _run(migrate, conn) -> None:
    session = Session(bind=conn)
    with (
        patch.object(migration, "op") as mock_op,
        patch.object(migration, "db") as mock_db,
    ):
        mock_op.get_bind.return_value = conn
        mock_db.Session.return_value = session
        migrate()


@pytest.mark.parametrize(
    "uri,expected",
    [
        # HTTP driver: scheme only changes, port (8123) is preserved as-is
        (
            f"clickhouse://user:{MASK}@host:8123/db",
            f"clickhousedb+connect://user:{MASK}@host:8123/db",
        ),
        # explicit +http driver maps to the same target
        (
            f"clickhouse+http://user:{MASK}@host:8123/db",
            f"clickhousedb+connect://user:{MASK}@host:8123/db",
        ),
        # no port and no credentials: nothing but the scheme is rewritten
        ("clickhouse://localhost/default", "clickhousedb+connect://localhost/default"),
        # query string and secure flag are preserved
        (
            f"clickhouse://user:{MASK}@host:8123/db?secure=true",
            f"clickhousedb+connect://user:{MASK}@host:8123/db?secure=true",
        ),
    ],
)
def test_migrate_uri_http_preserves_everything_but_scheme(
    uri: str, expected: str
) -> None:
    assert _migrate_uri(uri) == expected


@pytest.mark.parametrize(
    "uri,expected",
    [
        # native default port 9000 moves to the HTTP interface (8123)
        (
            f"clickhouse+native://user:{MASK}@host:9000/db",
            f"clickhousedb+connect://user:{MASK}@host:8123/db",
        ),
        # asynch is also a native-protocol driver
        (
            f"clickhouse+asynch://user:{MASK}@host:9000/db",
            f"clickhousedb+connect://user:{MASK}@host:8123/db",
        ),
        # no explicit port implies the native default 9000 -> pin 8123
        (
            f"clickhouse+native://user:{MASK}@host/db",
            f"clickhousedb+connect://user:{MASK}@host:8123/db",
        ),
        # host with no credentials
        (
            "clickhouse+native://host:9000/db",
            "clickhousedb+connect://host:8123/db",
        ),
    ],
)
def test_migrate_uri_native_remaps_default_port(uri: str, expected: str) -> None:
    assert _migrate_uri(uri) == expected


@pytest.mark.parametrize(
    "uri",
    [
        # already on the clickhousedb backend -> idempotent skip
        f"clickhousedb+connect://user:{MASK}@host:8123/db",
        f"clickhousedb://user:{MASK}@host:8443/db?secure=true",
        # a non-default native port can't be mapped to an HTTP port safely
        f"clickhouse+native://user:{MASK}@host:9440/db",
        # IPv6 literal host is left for a human rather than mis-parsed
        f"clickhouse+native://user:{MASK}@[::1]:9000/db",
        # an unrelated engine
        f"postgresql://user:{MASK}@host:5432/db",
        # not a URI at all
        "clickhouse-not-a-uri",
    ],
)
def test_migrate_uri_leaves_non_target_rows_alone(uri: str) -> None:
    assert _migrate_uri(uri) is None


def test_migrate_uri_ignores_at_sign_in_credentials() -> None:
    """The host section is located after the last "@" in the credentials."""
    assert (
        _migrate_uri("clickhouse+native://user:p@ss@host:9000/db")
        == "clickhousedb+connect://user:p@ss@host:8123/db"
    )


def test_migrate_uri_ignores_at_sign_in_query() -> None:
    """An "@" after the authority (in the path or query) must not be mistaken
    for the credential separator."""
    assert (
        _migrate_uri("clickhouse+native://host:9000/db?comment=a@b")
        == "clickhousedb+connect://host:8123/db?comment=a@b"
    )


@pytest.mark.parametrize(
    "uri,expected",
    [
        # legacy TLS flag (protocol=https) becomes clickhouse-connect's secure
        (
            f"clickhouse://user:{MASK}@host:8443/db?protocol=https",
            f"clickhousedb+connect://user:{MASK}@host:8443/db?secure=true",
        ),
        # protocol=http is the plaintext default and is simply dropped
        (
            f"clickhouse://user:{MASK}@host:8123/db?protocol=http",
            f"clickhousedb+connect://user:{MASK}@host:8123/db",
        ),
        # other parameters keep their position around the rewritten flag
        (
            f"clickhouse://user:{MASK}@host:8443/db?a=1&protocol=https&b=2",
            f"clickhousedb+connect://user:{MASK}@host:8443/db?a=1&secure=true&b=2",
        ),
        # native connection carrying the legacy TLS flag: port and flag both move
        (
            f"clickhouse+native://user:{MASK}@host:9000/db?protocol=https",
            f"clickhousedb+connect://user:{MASK}@host:8123/db?secure=true",
        ),
        # a secure flag already present is preserved untouched
        (
            f"clickhouse://user:{MASK}@host:8443/db?secure=true",
            f"clickhousedb+connect://user:{MASK}@host:8443/db?secure=true",
        ),
    ],
)
def test_migrate_uri_maps_legacy_tls_flag(uri: str, expected: str) -> None:
    assert _migrate_uri(uri) == expected


def test_migrate_uri_skips_rows_that_would_overflow_the_column() -> None:
    """The rewrite lengthens the URI, so a row already near the column limit is
    left on the legacy driver rather than truncated."""
    padding = "x" * (migration.URI_MAX_LENGTH - len("clickhouse://host/"))
    uri = f"clickhouse://host/{padding}"
    assert len(uri) <= migration.URI_MAX_LENGTH
    assert len(f"clickhousedb+connect://host/{padding}") > migration.URI_MAX_LENGTH
    assert _migrate_uri(uri) is None


def test_upgrade_rewrites_only_legacy_clickhouse_connections(engine) -> None:
    with Session(engine) as seed:
        seed.add_all(
            [
                Database(id=1, sqlalchemy_uri=f"clickhouse://user:{MASK}@host:8123/db"),
                Database(
                    id=2,
                    sqlalchemy_uri=f"clickhouse+native://user:{MASK}@host:9000/db",
                ),
                # non-default native port: stays on the legacy driver
                Database(
                    id=3,
                    sqlalchemy_uri=f"clickhouse+native://user:{MASK}@host:9440/db",
                ),
                # already on the new form: untouched
                Database(
                    id=4,
                    sqlalchemy_uri=f"clickhousedb+connect://user:{MASK}@host:8123/db",
                ),
                # different engine that merely shares the "click" prefix space
                Database(id=5, sqlalchemy_uri=f"postgresql://user:{MASK}@host:5432/db"),
            ]
        )
        seed.commit()

    with engine.begin() as conn:
        _run(migration.upgrade, conn)

    with Session(engine) as verify:
        assert (
            verify.get(Database, 1).sqlalchemy_uri
            == f"clickhousedb+connect://user:{MASK}@host:8123/db"
        )
        assert (
            verify.get(Database, 2).sqlalchemy_uri
            == f"clickhousedb+connect://user:{MASK}@host:8123/db"
        )
        assert (
            verify.get(Database, 3).sqlalchemy_uri
            == f"clickhouse+native://user:{MASK}@host:9440/db"
        )
        assert (
            verify.get(Database, 4).sqlalchemy_uri
            == f"clickhousedb+connect://user:{MASK}@host:8123/db"
        )
        assert (
            verify.get(Database, 5).sqlalchemy_uri
            == f"postgresql://user:{MASK}@host:5432/db"
        )


def test_upgrade_is_idempotent(engine) -> None:
    with Session(engine) as seed:
        seed.add(
            Database(id=1, sqlalchemy_uri=f"clickhouse://user:{MASK}@host:8123/db")
        )
        seed.commit()

    for _ in range(2):
        with engine.begin() as conn:
            _run(migration.upgrade, conn)

    with Session(engine) as verify:
        assert (
            verify.get(Database, 1).sqlalchemy_uri
            == f"clickhousedb+connect://user:{MASK}@host:8123/db"
        )


def test_downgrade_is_a_no_op(engine) -> None:
    """A migrated row is indistinguishable from a native clickhousedb one, so
    downgrade leaves the rewritten URIs in place."""
    migrated = f"clickhousedb+connect://user:{MASK}@host:8123/db"
    with Session(engine) as seed:
        seed.add(Database(id=1, sqlalchemy_uri=migrated))
        seed.commit()

    with engine.begin() as conn:
        _run(migration.downgrade, conn)

    with Session(engine) as verify:
        assert verify.get(Database, 1).sqlalchemy_uri == migrated
