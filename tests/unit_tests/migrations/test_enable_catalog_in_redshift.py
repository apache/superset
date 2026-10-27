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
"""Tests for migration ``e6d0a676a087_enable_catalog_in_redshift``.

Runs the migration's ``upgrade()``/``downgrade()`` over Redshift connections
(database in the URL, and IAM with the database in ``connect_args``) next to a
PostgreSQL connection, which must be left untouched.
"""

from importlib import import_module

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.migrations.shared.security_converge import (
    Permission,
    PermissionView,
    ViewMenu,
)

migration = import_module(
    "superset.migrations.versions."
    "2026-09-30_14-30_e6d0a676a087_enable_catalog_in_redshift"
)


def get_permissions(session: Session) -> set[tuple[str, str]]:
    return set(
        session.query(ViewMenu.name, Permission.name)
        .join(PermissionView, ViewMenu.id == PermissionView.view_menu_id)
        .join(Permission, PermissionView.permission_id == Permission.id)
        .all()
    )


@pytest.mark.parametrize(
    "sqlalchemy_uri,extra",
    [
        ("redshift+psycopg2://user:password@host:5439/dev", "{}"),
        (
            "redshift+redshift_connector://",
            '{"engine_params": {"connect_args": {"iam": true, "database": "dev"}}}',
        ),
    ],
)
def test_upgrade_downgrade(
    mocker: MockerFixture,
    session: Session,
    sqlalchemy_uri: str,
    extra: str,
) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.slice import Slice
    from superset.models.sql_lab import SavedQuery

    Database.metadata.create_all(session.get_bind())

    mocker.patch("superset.migrations.shared.catalogs.op")
    db = mocker.patch("superset.migrations.shared.catalogs.db")
    db.Session.return_value = session

    mocker.patch.object(Database, "get_all_schema_names", return_value=["public"])
    mocker.patch.object(
        Database,
        "get_all_catalog_names",
        return_value=["dev", "datashare_db"],
    )

    redshift = Database(
        database_name="redshift",
        sqlalchemy_uri=sqlalchemy_uri,
        extra=extra,
    )
    postgres = Database(
        database_name="postgres",
        sqlalchemy_uri="postgresql://user:password@host:5432/pg",
    )
    redshift_dataset = SqlaTable(
        table_name="t",
        database=redshift,
        catalog=None,
        schema="public",
        schema_perm="[redshift].[public]",
    )
    postgres_dataset = SqlaTable(
        table_name="t",
        database=postgres,
        catalog=None,
        schema="public",
        schema_perm="[postgres].[public]",
    )
    session.add_all([redshift_dataset, postgres_dataset])
    session.commit()

    chart = Slice(
        slice_name="c",
        datasource_type="table",
        datasource_id=redshift_dataset.id,
        schema_perm="[redshift].[public]",
    )
    saved_query = SavedQuery(
        database=redshift,
        sql="SELECT * FROM public.t",
        catalog=None,
        schema="public",
    )
    session.add_all([chart, saved_query])
    session.commit()

    before = get_permissions(session)
    assert ("[redshift].[public]", "schema_access") in before
    assert ("[postgres].[public]", "schema_access") in before

    migration.upgrade()
    session.commit()

    assert redshift_dataset.catalog == "dev"
    assert redshift_dataset.catalog_perm == "[redshift].[dev]"
    assert redshift_dataset.schema_perm == "[redshift].[dev].[public]"
    assert chart.catalog_perm == "[redshift].[dev]"
    assert chart.schema_perm == "[redshift].[dev].[public]"
    assert saved_query.catalog == "dev"

    after = get_permissions(session)
    assert ("[redshift].[public]", "schema_access") not in after
    assert {
        ("[redshift].[dev]", "catalog_access"),
        ("[redshift].[dev].[public]", "schema_access"),
        ("[redshift].[datashare_db]", "catalog_access"),
        ("[redshift].[datashare_db].[public]", "schema_access"),
    } <= after

    # PostgreSQL is not part of this migration
    assert postgres_dataset.catalog is None
    assert postgres_dataset.schema_perm == "[postgres].[public]"
    assert ("[postgres].[public]", "schema_access") in after

    migration.downgrade()
    session.commit()

    assert redshift_dataset.catalog is None
    assert redshift_dataset.catalog_perm is None
    assert redshift_dataset.schema_perm == "[redshift].[public]"
    assert chart.catalog_perm is None
    assert chart.schema_perm == "[redshift].[public]"
    assert saved_query.catalog is None
    assert postgres_dataset.schema_perm == "[postgres].[public]"
    assert get_permissions(session) == before
