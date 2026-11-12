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
"""Tests for migration ``a3f5c9e21b84_migrate_databricks_odbc_to_native_uri``.

Covers the scheme-swap helper, the upgrade() path over a mixture of Databricks
ODBC, native ``databricks://`` and unrelated connections, downgrade() protecting
natively-created ``databricks://`` connections (including ones carrying a copied
marker), skipping rows with malformed ``extra``, and the full round trip.
"""

from __future__ import annotations

from importlib import import_module
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from superset.utils import json

migration = import_module(
    "superset.migrations.versions."
    "2026-09-15_00-00_a3f5c9e21b84_migrate_databricks_odbc_to_native_uri"
)

Database = migration.Database
_swap_scheme = migration._swap_scheme
ODBC_SCHEME = migration.ODBC_SCHEME
NATIVE_SCHEME = migration.NATIVE_SCHEME
MARKER = migration.MIGRATION_MARKER
REVISION = migration.revision

# Superset stores the password as this mask rather than the real credential
MASK = "X" * 10

# ODBC connections keep http_path (and optionally catalog/schema) here, which is
# also where the native databricks:// spec reads them, so it rides along untouched.
EXTRA = json.dumps(
    {"engine_params": {"connect_args": {"http_path": "/sql/1.0/warehouses/abc"}}}
)


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
        (
            f"databricks+pyodbc://token:{MASK}@host:443/db",
            f"databricks://token:{MASK}@host:443/db",
        ),
        # unrelated query parameters (e.g. the encryption flag) are preserved
        (
            f"databricks+pyodbc://token:{MASK}@host:443/db?ssl=1",
            f"databricks://token:{MASK}@host:443/db?ssl=1",
        ),
        # http_path in the query string, as in the ODBC spec's documented URI
        (
            f"databricks+pyodbc://token:{MASK}@host:443/db?http_path=/sql/1.0/x",
            f"databricks://token:{MASK}@host:443/db?http_path=/sql/1.0/x",
        ),
    ],
)
def test_swap_scheme_rewrites_only_the_scheme(uri: str, expected: str) -> None:
    assert _swap_scheme(uri, ODBC_SCHEME, NATIVE_SCHEME) == expected


@pytest.mark.parametrize(
    "uri",
    [
        # already migrated / different driver
        f"databricks://token:{MASK}@host:443/db",
        f"databricks://token:{MASK}@host:443?http_path=/x",
        f"databricks+connector://token:{MASK}@host:443/db",
        # the driver string only appears in credentials, not the scheme
        f"postgresql://databricks+pyodbc:{MASK}@host:5432/db",
    ],
)
def test_swap_scheme_leaves_non_matching_uris_alone(uri: str) -> None:
    assert _swap_scheme(uri, ODBC_SCHEME, NATIVE_SCHEME) is None


def test_upgrade_rewrites_only_odbc_connections(engine) -> None:
    with Session(engine) as seed:
        seed.add_all(
            [
                Database(
                    id=1,
                    sqlalchemy_uri=f"databricks+pyodbc://token:{MASK}@host:443/main",
                    extra=EXTRA,
                ),
                # a Databricks connection already on the native scheme
                Database(
                    id=2,
                    sqlalchemy_uri=f"databricks://token:{MASK}@host:443/main",
                    extra=EXTRA,
                ),
                # a different engine, untouched
                Database(
                    id=3,
                    sqlalchemy_uri=f"postgresql://user:{MASK}@host:5432/db",
                    extra=None,
                ),
            ]
        )
        seed.commit()

    with engine.begin() as conn:
        _run(migration.upgrade, conn)

    with Session(engine) as verify:
        migrated = verify.get(Database, 1)
        assert migrated.sqlalchemy_uri == f"databricks://token:{MASK}@host:443/main"
        # credentials-bearing extra is preserved and the marker is added
        extra = json.loads(migrated.extra)
        assert extra["engine_params"]["connect_args"]["http_path"] == (
            "/sql/1.0/warehouses/abc"
        )
        assert extra[MARKER] == {"revision": REVISION, "database_id": 1}

        # native connection is left exactly as it was (no marker)
        native = verify.get(Database, 2)
        assert native.sqlalchemy_uri == f"databricks://token:{MASK}@host:443/main"
        assert MARKER not in json.loads(native.extra)

        assert (
            verify.get(Database, 3).sqlalchemy_uri
            == f"postgresql://user:{MASK}@host:5432/db"
        )


def test_upgrade_is_idempotent(engine) -> None:
    with Session(engine) as seed:
        seed.add(
            Database(
                id=1,
                sqlalchemy_uri=f"databricks+pyodbc://token:{MASK}@host:443/main",
                extra=EXTRA,
            )
        )
        seed.commit()

    for _ in range(2):
        with engine.begin() as conn:
            _run(migration.upgrade, conn)

    with Session(engine) as verify:
        assert (
            verify.get(Database, 1).sqlalchemy_uri
            == f"databricks://token:{MASK}@host:443/main"
        )


def test_downgrade_only_reverts_migrated_connections(engine) -> None:
    """
    downgrade must revert the rows upgrade migrated (marker present) and leave
    natively-created databricks:// connections on that scheme.
    """
    marked_extra = json.dumps(
        {
            "engine_params": {"connect_args": {"http_path": "/sql/1.0/warehouses/abc"}},
            MARKER: {"revision": REVISION, "database_id": 1},
        }
    )
    with Session(engine) as seed:
        seed.add_all(
            [
                Database(
                    id=1,
                    sqlalchemy_uri=f"databricks://token:{MASK}@host:443/main",
                    extra=marked_extra,
                ),
                Database(
                    id=2,
                    sqlalchemy_uri=f"databricks://token:{MASK}@host:443/main",
                    extra=EXTRA,
                ),
            ]
        )
        seed.commit()

    with engine.begin() as conn:
        _run(migration.downgrade, conn)

    with Session(engine) as verify:
        reverted = verify.get(Database, 1)
        assert (
            reverted.sqlalchemy_uri == f"databricks+pyodbc://token:{MASK}@host:443/main"
        )
        # the marker is stripped so the row is indistinguishable from the original
        assert MARKER not in json.loads(reverted.extra)

        native = verify.get(Database, 2)
        assert native.sqlalchemy_uri == f"databricks://token:{MASK}@host:443/main"


def test_round_trip_through_upgrade_and_downgrade(engine) -> None:
    original_uri = f"databricks+pyodbc://token:{MASK}@host:443/main"
    with Session(engine) as seed:
        seed.add(Database(id=1, sqlalchemy_uri=original_uri, extra=EXTRA))
        seed.commit()

    with engine.begin() as conn:
        _run(migration.upgrade, conn)
    with engine.begin() as conn:
        _run(migration.downgrade, conn)

    with Session(engine) as verify:
        database = verify.get(Database, 1)
        assert database.sqlalchemy_uri == original_uri
        assert json.loads(database.extra) == json.loads(EXTRA)


def test_upgrade_skips_rows_with_malformed_extra(engine) -> None:
    """
    A row whose extra is not a JSON object is left untouched, and the rest of
    the run still migrates every other ODBC connection.
    """
    odbc_uri = f"databricks+pyodbc://token:{MASK}@host:443/main"
    with Session(engine) as seed:
        seed.add_all(
            [
                Database(id=1, sqlalchemy_uri=odbc_uri, extra="not json"),
                Database(id=2, sqlalchemy_uri=odbc_uri, extra="[1, 2]"),
                Database(id=3, sqlalchemy_uri=odbc_uri, extra=EXTRA),
            ]
        )
        seed.commit()

    with engine.begin() as conn:
        _run(migration.upgrade, conn)

    with Session(engine) as verify:
        for database_id, extra in ((1, "not json"), (2, "[1, 2]")):
            skipped = verify.get(Database, database_id)
            assert skipped.sqlalchemy_uri == odbc_uri
            assert skipped.extra == extra

        migrated = verify.get(Database, 3)
        assert migrated.sqlalchemy_uri == f"databricks://token:{MASK}@host:443/main"
        assert json.loads(migrated.extra)[MARKER] == {
            "revision": REVISION,
            "database_id": 3,
        }


@pytest.mark.parametrize(
    "marker",
    [
        # extra copied from migrated connection id=1 onto a different row
        {"revision": REVISION, "database_id": 1},
        # a marker from a different revision
        {"revision": "000000000000", "database_id": 2},
        # a bare truthy value that does not identify this revision and row
        True,
    ],
)
def test_downgrade_ignores_markers_not_written_for_the_row(engine, marker) -> None:
    native_uri = f"databricks://token:{MASK}@host:443/main"
    extra = json.dumps({MARKER: marker})
    with Session(engine) as seed:
        seed.add(Database(id=2, sqlalchemy_uri=native_uri, extra=extra))
        seed.commit()

    with engine.begin() as conn:
        _run(migration.downgrade, conn)

    with Session(engine) as verify:
        native = verify.get(Database, 2)
        assert native.sqlalchemy_uri == native_uri
        assert native.extra == extra


def test_downgrade_skips_rows_with_malformed_extra(engine) -> None:
    native_uri = f"databricks://token:{MASK}@host:443/main"
    with Session(engine) as seed:
        seed.add(Database(id=1, sqlalchemy_uri=native_uri, extra="not json"))
        seed.commit()

    with engine.begin() as conn:
        _run(migration.downgrade, conn)

    with Session(engine) as verify:
        assert verify.get(Database, 1).sqlalchemy_uri == native_uri


def test_upgrade_preserves_odbc_connect_args_and_skips_legacy_connector(
    engine,
) -> None:
    """
    ODBC-only connect args (``driver_path``) ride along unchanged, and a legacy
    ``databricks+connector`` row is left for ``b8f3a2c91d64``'s own conversion
    rather than being touched by either direction of this migration.
    """
    odbc_extra = {
        "engine_params": {
            "connect_args": {
                "http_path": "/sql/1.0/endpoints/abc",
                "driver_path": "/opt/simba/spark/lib/64/libsparkodbc_sb64.so",
            }
        },
        "metadata_params": {},
    }
    legacy_uri = f"databricks+connector://token:{MASK}@host:443/main"
    with Session(engine) as seed:
        seed.add_all(
            [
                Database(
                    id=1,
                    sqlalchemy_uri=f"databricks+pyodbc://token:{MASK}@host:443/main",
                    extra=json.dumps(odbc_extra),
                ),
                Database(id=2, sqlalchemy_uri=legacy_uri, extra=EXTRA),
            ]
        )
        seed.commit()

    with engine.begin() as conn:
        _run(migration.upgrade, conn)

    with Session(engine) as verify:
        migrated = verify.get(Database, 1)
        assert migrated.sqlalchemy_uri == f"databricks://token:{MASK}@host:443/main"
        extra = json.loads(migrated.extra)
        assert extra.pop(MARKER) == {"revision": REVISION, "database_id": 1}
        assert extra == odbc_extra
        assert verify.get(Database, 2).sqlalchemy_uri == legacy_uri

    with engine.begin() as conn:
        _run(migration.downgrade, conn)

    with Session(engine) as verify:
        reverted = verify.get(Database, 1)
        assert (
            reverted.sqlalchemy_uri == f"databricks+pyodbc://token:{MASK}@host:443/main"
        )
        assert json.loads(reverted.extra) == odbc_extra
        legacy = verify.get(Database, 2)
        assert legacy.sqlalchemy_uri == legacy_uri
        assert legacy.extra == EXTRA
