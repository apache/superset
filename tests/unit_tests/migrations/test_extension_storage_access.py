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
"""Exercise the access classification migration against a legacy storage table."""

from importlib import import_module

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

migration = import_module(
    "superset.migrations.versions."
    "2026-09-28_00-00_4c8f2a1d9b73_add_extension_storage_access"
)


@pytest.mark.parametrize("resource_scoped", [False, True])
def test_access_migration_preserves_frontend_rows_and_removes_secrets(
    resource_scoped: bool,
) -> None:
    """Upgrade classifies legacy rows; downgrade never exposes backend secrets."""
    engine = sa.create_engine("sqlite:///:memory:")
    metadata = sa.MetaData()
    scoped_key = [
        "extension_id",
        "user_fk",
        "resource_type",
        "resource_uuid",
        "key",
    ]
    table = sa.Table(
        "extension_storage",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("extension_id", sa.String(255), nullable=False),
        sa.Column("user_fk", sa.Integer),
        sa.Column("resource_type", sa.String(64)),
        sa.Column("resource_uuid", sa.String(36)),
        sa.Column("key", sa.String(255), nullable=False),
        sa.Column("value", sa.LargeBinary, nullable=False),
        sa.UniqueConstraint(*scoped_key, name="uq_extension_storage_scoped_key"),
    )
    sa.Index("ix_ext_storage_lookup", *(table.c[name] for name in scoped_key))
    metadata.create_all(engine)
    scope = {
        "extension_id": "acme.semantic",
        "user_fk": 42,
        "resource_type": "semantic_layer" if resource_scoped else None,
        "resource_uuid": "00000000-0000-0000-0000-000000000001"
        if resource_scoped
        else None,
        "key": "token",
    }
    legacy_value = b"browser-visible-setting"
    try:
        with engine.begin() as connection:
            connection.execute(table.insert().values(id=1, value=legacy_value, **scope))
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
                upgraded = sa.Table(
                    "extension_storage", sa.MetaData(), autoload_with=connection
                )
                row = connection.execute(sa.select(upgraded)).mappings().one()
                assert row["access"] == "frontend"
                assert row["value"] == legacy_value

                # Both access classes must coexist under the same scoped key.
                connection.execute(
                    upgraded.insert().values(
                        id=2,
                        access="backend",
                        value=b"encrypted-personal-token",
                        **scope,
                    )
                )
                connection.execute(
                    upgraded.insert().values(
                        **{**scope, "key": "refresh_token"},
                        id=3,
                        access="backend",
                        value=b"encrypted-refresh-token",
                    )
                )
                migration.downgrade()

            downgraded = sa.Table(
                "extension_storage", sa.MetaData(), autoload_with=connection
            )
            assert "access" not in downgraded.c
            assert connection.execute(sa.select(downgraded)).mappings().all() == [
                {"id": 1, "value": legacy_value, **scope}
            ]
            inspector = sa.inspect(connection)
            assert inspector.get_unique_constraints("extension_storage") == [
                {
                    "name": "uq_extension_storage_scoped_key",
                    "column_names": scoped_key,
                }
            ]
            indexes = {
                index["name"]: index["column_names"]
                for index in inspector.get_indexes("extension_storage")
            }
            assert indexes["ix_ext_storage_lookup"] == scoped_key
    finally:
        engine.dispose()
