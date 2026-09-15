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
"""Tests for migration ``a3f5c9e21b84_migrate_databricks_odbc_to_connector``.

Covers the scheme-swap helper, the upgrade() path over a mixture of Databricks
ODBC, native connector and unrelated connections, downgrade() protecting
natively-created connector connections, and the full round trip.
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
    "2026-09-15_00-00_a3f5c9e21b84_migrate_databricks_odbc_to_connector"
)

Database = migration.Database
_swap_scheme = migration._swap_scheme
ODBC_PREFIX = migration.ODBC_PREFIX
CONNECTOR_PREFIX = migration.CONNECTOR_PREFIX
MARKER = migration.MIGRATION_MARKER

# Superset stores the password as this mask rather than the real credential
MASK = "X" * 10

# Databricks stores http_path (and optionally catalog/schema) here for both
# the ODBC and the connector driver, so it rides along untouched.
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
            f"databricks+connector://token:{MASK}@host:443/db",
        ),
        # unrelated query parameters (e.g. the encryption flag) are preserved
        (
            f"databricks+pyodbc://token:{MASK}@host:443/db?ssl=1",
            f"databricks+connector://token:{MASK}@host:443/db?ssl=1",
        ),
    ],
)
def test_swap_scheme_rewrites_only_the_driver(uri: str, expected: str) -> None:
    assert _swap_scheme(uri, ODBC_PREFIX, CONNECTOR_PREFIX) == expected


@pytest.mark.parametrize(
    "uri",
    [
        # already migrated / different driver
        f"databricks+connector://token:{MASK}@host:443/db",
        f"databricks://token:{MASK}@host:443?http_path=/x",
        # the driver string only appears in credentials, not the scheme
        f"postgresql://databricks+pyodbc:{MASK}@host:5432/db",
    ],
)
def test_swap_scheme_leaves_non_matching_uris_alone(uri: str) -> None:
    assert _swap_scheme(uri, ODBC_PREFIX, CONNECTOR_PREFIX) is None


def test_upgrade_rewrites_only_odbc_connections(engine) -> None:
    with Session(engine) as seed:
        seed.add_all(
            [
                Database(
                    id=1,
                    sqlalchemy_uri=f"databricks+pyodbc://token:{MASK}@host:443/main",
                    extra=EXTRA,
                ),
                # a Databricks connection already on the connector driver
                Database(
                    id=2,
                    sqlalchemy_uri=f"databricks+connector://token:{MASK}@host:443/main",
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
        assert (
            migrated.sqlalchemy_uri
            == f"databricks+connector://token:{MASK}@host:443/main"
        )
        # credentials-bearing extra is preserved and the marker is added
        extra = json.loads(migrated.extra)
        assert extra["engine_params"]["connect_args"]["http_path"] == (
            "/sql/1.0/warehouses/abc"
        )
        assert extra[MARKER] is True

        # native connector connection is left exactly as it was (no marker)
        native = verify.get(Database, 2)
        assert (
            native.sqlalchemy_uri
            == f"databricks+connector://token:{MASK}@host:443/main"
        )
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
            == f"databricks+connector://token:{MASK}@host:443/main"
        )


def test_downgrade_only_reverts_migrated_connections(engine) -> None:
    """
    downgrade must revert the rows upgrade migrated (marker present) and leave
    natively-created connector connections on the connector driver.
    """
    marked_extra = json.dumps(
        {
            "engine_params": {"connect_args": {"http_path": "/sql/1.0/warehouses/abc"}},
            MARKER: True,
        }
    )
    with Session(engine) as seed:
        seed.add_all(
            [
                Database(
                    id=1,
                    sqlalchemy_uri=f"databricks+connector://token:{MASK}@host:443/main",
                    extra=marked_extra,
                ),
                Database(
                    id=2,
                    sqlalchemy_uri=f"databricks+connector://token:{MASK}@host:443/main",
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
        assert (
            native.sqlalchemy_uri
            == f"databricks+connector://token:{MASK}@host:443/main"
        )


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
