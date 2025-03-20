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

import json

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import app
from superset.migrations.shared.catalogs import (
    downgrade_catalog_perms,
    upgrade_catalog_perms,
)
from superset.migrations.shared.security_converge import (
    Permission,
    PermissionView,
    ViewMenu,
)
from superset.superset_typing import OAuth2ClientConfig


@pytest.fixture
def oauth2_config() -> OAuth2ClientConfig:
    """
    Config for GSheets OAuth2.
    """
    return {
        "id": "XXX.apps.googleusercontent.com",
        "secret": "GOCSPX-YYY",
        "scope": " ".join(
            [
                "https://www.googleapis.com/auth/drive.readonly "
                "https://www.googleapis.com/auth/spreadsheets "
                "https://spreadsheets.google.com/feeds"
            ]
        ),
        "redirect_uri": "http://localhost:8088/api/v1/oauth2/",
        "authorization_request_uri": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_request_uri": "https://oauth2.googleapis.com/token",
        "request_content_type": "json",
    }


def test_upgrade_catalog_perms(mocker: MockerFixture, session: Session) -> None:
    """
    Test the `upgrade_catalog_perms` function.

    The function is called when catalogs are introduced into a new DB engine spec.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.slice import Slice
    from superset.models.sql_lab import Query, SavedQuery, TableSchema, TabState

    engine = session.get_bind()
    Database.metadata.create_all(engine)

    mocker.patch("superset.migrations.shared.catalogs.op")
    db = mocker.patch("superset.migrations.shared.catalogs.db")
    db.Session.return_value = session

    mocker.patch.object(
        Database,
        "get_all_schema_names",
        return_value=["public", "information_schema"],
    )
    mocker.patch.object(
        Database,
        "get_all_catalog_names",
        return_value=["db", "other_catalog"],
    )

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="postgresql://localhost/db",
    )
    dataset = SqlaTable(
        table_name="my_table",
        database=database,
        catalog=None,
        schema="public",
        catalog_perm=None,
        schema_perm="[my_db].[public]",
    )
    session.add(dataset)
    session.commit()

    chart = Slice(
        slice_name="my_chart",
        datasource_type="table",
        datasource_id=dataset.id,
        catalog_perm=None,
        schema_perm="[my_db].[public]",
    )
    query = Query(
        client_id="foo",
        database=database,
        catalog=None,
        schema="public",
    )
    saved_query = SavedQuery(
        database=database,
        sql="SELECT * FROM public.t",
        catalog=None,
        schema="public",
    )
    tab_state = TabState(
        database=database,
        catalog=None,
        schema="public",
    )
    table_schema = TableSchema(
        database=database,
        catalog=None,
        schema="public",
    )
    session.add_all([chart, query, saved_query, tab_state, table_schema])
    session.commit()

    # before migration
    assert dataset.catalog is None
    assert query.catalog is None
    assert saved_query.catalog is None
    assert tab_state.catalog is None
    assert table_schema.catalog is None
    assert dataset.catalog_perm is None
    assert dataset.schema_perm == "[my_db].[public]"
    assert chart.catalog_perm is None
    assert chart.schema_perm == "[my_db].[public]"
    assert (
        session.query(ViewMenu.name, Permission.name)
        .join(PermissionView, ViewMenu.id == PermissionView.view_menu_id)
        .join(Permission, PermissionView.permission_id == Permission.id)
        .all()
    ) == [
        ("[my_db].(id:1)", "database_access"),
        ("[my_db].[my_table](id:1)", "datasource_access"),
        ("[my_db].[public]", "schema_access"),
    ]

    upgrade_catalog_perms()
    session.commit()

    # add dataset/chart in new catalog
    new_dataset = SqlaTable(
        table_name="my_table",
        database=database,
        catalog="other_catalog",
        schema="public",
        schema_perm="[my_db].[other_catalog].[public]",
        catalog_perm="[my_db].[other_catalog]",
    )
    session.add(new_dataset)
    session.commit()

    new_chart = Slice(
        slice_name="my_chart",
        datasource_type="table",
        datasource_id=new_dataset.id,
    )
    session.add(new_chart)
    session.commit()

    # after migration
    assert dataset.catalog == "db"
    assert query.catalog == "db"
    assert saved_query.catalog == "db"
    assert tab_state.catalog == "db"
    assert table_schema.catalog == "db"
    assert dataset.catalog_perm == "[my_db].[db]"
    assert dataset.schema_perm == "[my_db].[db].[public]"
    assert chart.catalog_perm == "[my_db].[db]"
    assert chart.schema_perm == "[my_db].[db].[public]"
    assert (
        session.query(ViewMenu.name, Permission.name)
        .join(PermissionView, ViewMenu.id == PermissionView.view_menu_id)
        .join(Permission, PermissionView.permission_id == Permission.id)
        .all()
    ) == [
        ("[my_db].(id:1)", "database_access"),
        ("[my_db].[my_table](id:1)", "datasource_access"),
        ("[my_db].[db].[public]", "schema_access"),
        ("[my_db].[db]", "catalog_access"),
        ("[my_db].[other_catalog]", "catalog_access"),
        ("[my_db].[other_catalog].[public]", "schema_access"),
        ("[my_db].[other_catalog].[information_schema]", "schema_access"),
        ("[my_db].[my_table](id:2)", "datasource_access"),
    ]

    # do a downgrade
    downgrade_catalog_perms()
    session.commit()

    # revert
    assert dataset.catalog is None
    assert query.catalog is None
    assert saved_query.catalog is None
    assert tab_state.catalog is None
    assert table_schema.catalog is None
    assert dataset.catalog_perm is None
    assert dataset.schema_perm == "[my_db].[public]"
    assert chart.catalog_perm is None
    assert chart.schema_perm == "[my_db].[public]"
    assert (
        session.query(ViewMenu.name, Permission.name)
        .join(PermissionView, ViewMenu.id == PermissionView.view_menu_id)
        .join(Permission, PermissionView.permission_id == Permission.id)
        .all()
    ) == [
        ("[my_db].(id:1)", "database_access"),
        ("[my_db].[my_table](id:1)", "datasource_access"),
        ("[my_db].[public]", "schema_access"),
    ]

    # make sure new dataset/chart were deleted
    assert session.query(SqlaTable).all() == [dataset]
    assert session.query(Slice).all() == [chart]


def test_upgrade_catalog_perms_graceful(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test the `upgrade_catalog_perms` function when it fails to connect to the DB.

    During the migration we try to connect to the analytical database to get the list of
    schemas. This should fail gracefully and not raise an exception, since the database
    could be offline, and the permissions can be generated later then the admin enables
    catalog browsing on the database (permissions are always synced on a DB update, see
    `UpdateDatabaseCommand`).
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.slice import Slice
    from superset.models.sql_lab import Query, SavedQuery, TableSchema, TabState

    engine = session.get_bind()
    Database.metadata.create_all(engine)

    mocker.patch("superset.migrations.shared.catalogs.op")
    db = mocker.patch("superset.migrations.shared.catalogs.db")
    db.Session.return_value = session

    mocker.patch.object(
        Database,
        "get_all_schema_names",
        side_effect=Exception("Failed to connect to the database"),
    )
    mocker.patch("superset.migrations.shared.catalogs.op", session)

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="postgresql://localhost/db",
    )
    dataset = SqlaTable(
        table_name="my_table",
        database=database,
        catalog=None,
        schema="public",
        schema_perm="[my_db].[public]",
    )
    session.add(dataset)
    session.commit()

    chart = Slice(
        slice_name="my_chart",
        datasource_type="table",
        datasource_id=dataset.id,
    )
    query = Query(
        client_id="foo",
        database=database,
        catalog=None,
        schema="public",
    )
    saved_query = SavedQuery(
        database=database,
        sql="SELECT * FROM public.t",
        catalog=None,
        schema="public",
    )
    tab_state = TabState(
        database=database,
        catalog=None,
        schema="public",
    )
    table_schema = TableSchema(
        database=database,
        catalog=None,
        schema="public",
    )
    session.add_all([chart, query, saved_query, tab_state, table_schema])
    session.commit()

    # before migration
    assert dataset.catalog is None
    assert query.catalog is None
    assert saved_query.catalog is None
    assert tab_state.catalog is None
    assert table_schema.catalog is None
    assert dataset.schema_perm == "[my_db].[public]"
    assert chart.schema_perm == "[my_db].[public]"
    assert session.query(ViewMenu.name).all() == [
        ("[my_db].(id:1)",),
        ("[my_db].[my_table](id:1)",),
        ("[my_db].[public]",),
    ]

    upgrade_catalog_perms()
    session.commit()

    # after migration
    assert dataset.catalog == "db"
    assert query.catalog == "db"
    assert saved_query.catalog == "db"
    assert tab_state.catalog == "db"
    assert table_schema.catalog == "db"
    assert dataset.schema_perm == "[my_db].[db].[public]"
    assert chart.schema_perm == "[my_db].[db].[public]"
    assert session.query(ViewMenu.name).all() == [
        ("[my_db].(id:1)",),
        ("[my_db].[my_table](id:1)",),
        ("[my_db].[db].[public]",),
        ("[my_db].[db]",),
    ]

    downgrade_catalog_perms()
    session.commit()

    # revert
    assert dataset.catalog is None
    assert query.catalog is None
    assert saved_query.catalog is None
    assert tab_state.catalog is None
    assert table_schema.catalog is None
    assert dataset.schema_perm == "[my_db].[public]"
    assert chart.schema_perm == "[my_db].[public]"
    assert session.query(ViewMenu.name).all() == [
        ("[my_db].(id:1)",),
        ("[my_db].[my_table](id:1)",),
        ("[my_db].[public]",),
    ]


def test_upgrade_catalog_perms_oauth_connection(
    mocker: MockerFixture,
    session: Session,
    oauth2_config: OAuth2ClientConfig,
) -> None:
    """
    Test the `upgrade_catalog_perms` function when the DB is set up using OAuth.

    During the migration we try to connect to the analytical database to get the list of
    schemas. This step should be skipped if the database is set up using OAuth and not
    raise an exception.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.slice import Slice
    from superset.models.sql_lab import Query, SavedQuery, TableSchema, TabState

    engine = session.get_bind()
    Database.metadata.create_all(engine)

    mocker.patch("superset.migrations.shared.catalogs.op")
    db = mocker.patch("superset.migrations.shared.catalogs.db")
    db.Session.return_value = session
    add_non_default_catalogs = mocker.patch(
        "superset.migrations.shared.catalogs.add_non_default_catalogs"
    )
    mocker.patch("superset.migrations.shared.catalogs.op", session)

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="bigquery://my-test-project",
        encrypted_extra=json.dumps({"oauth2_client_info": oauth2_config}),
    )
    dataset = SqlaTable(
        table_name="my_table",
        database=database,
        catalog=None,
        schema="public",
        schema_perm="[my_db].[public]",
    )
    session.add(dataset)
    session.commit()

    chart = Slice(
        slice_name="my_chart",
        datasource_type="table",
        datasource_id=dataset.id,
    )
    query = Query(
        client_id="foo",
        database=database,
        catalog=None,
        schema="public",
    )
    saved_query = SavedQuery(
        database=database,
        sql="SELECT * FROM public.t",
        catalog=None,
        schema="public",
    )
    tab_state = TabState(
        database=database,
        catalog=None,
        schema="public",
    )
    table_schema = TableSchema(
        database=database,
        catalog=None,
        schema="public",
    )
    session.add_all([chart, query, saved_query, tab_state, table_schema])
    session.commit()

    # before migration
    assert dataset.catalog is None
    assert query.catalog is None
    assert saved_query.catalog is None
    assert tab_state.catalog is None
    assert table_schema.catalog is None
    assert dataset.schema_perm == "[my_db].[public]"
    assert chart.schema_perm == "[my_db].[public]"
    assert session.query(ViewMenu.name).all() == [
        ("[my_db].(id:1)",),
        ("[my_db].[my_table](id:1)",),
        ("[my_db].[public]",),
    ]

    upgrade_catalog_perms()
    session.commit()

    # after migration
    assert dataset.catalog == "my-test-project"
    assert query.catalog == "my-test-project"
    assert saved_query.catalog == "my-test-project"
    assert tab_state.catalog == "my-test-project"
    assert table_schema.catalog == "my-test-project"
    assert dataset.schema_perm == "[my_db].[my-test-project].[public]"
    assert chart.schema_perm == "[my_db].[my-test-project].[public]"
    assert session.query(ViewMenu.name).all() == [
        ("[my_db].(id:1)",),
        ("[my_db].[my_table](id:1)",),
        ("[my_db].[my-test-project].[public]",),
        ("[my_db].[my-test-project]",),
    ]

    add_non_default_catalogs.assert_not_called()

    downgrade_catalog_perms()
    session.commit()

    # revert
    assert dataset.catalog is None
    assert query.catalog is None
    assert saved_query.catalog is None
    assert tab_state.catalog is None
    assert table_schema.catalog is None
    assert dataset.schema_perm == "[my_db].[public]"
    assert chart.schema_perm == "[my_db].[public]"
    assert session.query(ViewMenu.name).all() == [
        ("[my_db].(id:1)",),
        ("[my_db].[my_table](id:1)",),
        ("[my_db].[public]",),
    ]


def test_upgrade_catalog_perms_simplified_migration(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test the `upgrade_catalog_perms` function when the ``CATALOGS_SIMPLIFIED_MIGRATION``
    config is set to ``True``.

    This should only update existing permissions + create a new permission
    for the default catalog.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.slice import Slice
    from superset.models.sql_lab import Query, SavedQuery, TableSchema, TabState

    engine = session.get_bind()
    Database.metadata.create_all(engine)

    mocker.patch("superset.migrations.shared.catalogs.op")
    db = mocker.patch("superset.migrations.shared.catalogs.db")
    db.Session.return_value = session
    add_non_default_catalogs = mocker.patch(
        "superset.migrations.shared.catalogs.add_non_default_catalogs"
    )
    mocker.patch("superset.migrations.shared.catalogs.op", session)

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="bigquery://my-test-project",
    )
    dataset = SqlaTable(
        table_name="my_table",
        database=database,
        catalog=None,
        schema="public",
        schema_perm="[my_db].[public]",
    )
    session.add(dataset)
    session.commit()

    chart = Slice(
        slice_name="my_chart",
        datasource_type="table",
        datasource_id=dataset.id,
    )
    query = Query(
        client_id="foo",
        database=database,
        catalog=None,
        schema="public",
    )
    saved_query = SavedQuery(
        database=database,
        sql="SELECT * FROM public.t",
        catalog=None,
        schema="public",
    )
    tab_state = TabState(
        database=database,
        catalog=None,
        schema="public",
    )
    table_schema = TableSchema(
        database=database,
        catalog=None,
        schema="public",
    )
    session.add_all([chart, query, saved_query, tab_state, table_schema])
    session.commit()

    # before migration
    assert dataset.catalog is None
    assert query.catalog is None
    assert saved_query.catalog is None
    assert tab_state.catalog is None
    assert table_schema.catalog is None
    assert dataset.schema_perm == "[my_db].[public]"
    assert chart.schema_perm == "[my_db].[public]"
    assert session.query(ViewMenu.name).all() == [
        ("[my_db].(id:1)",),
        ("[my_db].[my_table](id:1)",),
        ("[my_db].[public]",),
    ]

    with app.test_request_context():
        app.config["CATALOGS_SIMPLIFIED_MIGRATION"] = True
        upgrade_catalog_perms()
        session.commit()

    # after migration
    assert dataset.catalog == "my-test-project"
    assert query.catalog == "my-test-project"
    assert saved_query.catalog == "my-test-project"
    assert tab_state.catalog == "my-test-project"
    assert table_schema.catalog == "my-test-project"
    assert dataset.schema_perm == "[my_db].[my-test-project].[public]"
    assert chart.schema_perm == "[my_db].[my-test-project].[public]"
    assert session.query(ViewMenu.name).all() == [
        ("[my_db].(id:1)",),
        ("[my_db].[my_table](id:1)",),
        ("[my_db].[my-test-project].[public]",),
        ("[my_db].[my-test-project]",),
    ]

    add_non_default_catalogs.assert_not_called()

    downgrade_catalog_perms()
    session.commit()

    # revert
    assert dataset.catalog is None
    assert query.catalog is None
    assert saved_query.catalog is None
    assert tab_state.catalog is None
    assert table_schema.catalog is None
    assert dataset.schema_perm == "[my_db].[public]"
    assert chart.schema_perm == "[my_db].[public]"
    assert session.query(ViewMenu.name).all() == [
        ("[my_db].(id:1)",),
        ("[my_db].[my_table](id:1)",),
        ("[my_db].[public]",),
    ]
