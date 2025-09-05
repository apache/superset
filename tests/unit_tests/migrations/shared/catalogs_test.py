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

import json  # noqa: TID251

import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

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
    from superset.migrations.shared.catalogs import (
        Database,
        Query,
        SavedQuery,
        Slice,
        SqlaTable,
        TableSchema,
        TabState,
    )

    engine = session.get_bind()
    Database.metadata.create_all(engine)
    Permission.metadata.create_all(engine)
    PermissionView.metadata.create_all(engine)
    ViewMenu.metadata.create_all(engine)

    mocker.patch("superset.migrations.shared.catalogs.op")
    db = mocker.patch("superset.migrations.shared.catalogs.db")
    db.Session.return_value = session

    # Mock current_app.config to ensure we don't skip non-default catalogs
    mocker.patch.dict(
        "superset.migrations.shared.catalogs.current_app.config",
        {"CATALOGS_SIMPLIFIED_MIGRATION": False},
    )

    # Mock the db_engine_spec methods instead of the Database model methods
    mock_db_engine_spec = mocker.MagicMock()
    mock_db_engine_spec.supports_catalog = True
    mock_db_engine_spec.get_default_catalog.return_value = "db"
    mock_db_engine_spec.get_all_schema_names.return_value = [
        "public",
        "information_schema",
    ]
    mock_db_engine_spec.get_all_catalog_names.return_value = ["db", "other_catalog"]

    mocker.patch.object(
        Database,
        "db_engine_spec",
        new_callable=mocker.PropertyMock,
        return_value=mock_db_engine_spec,
    )
    mocker.patch.object(
        Database,
        "get_default_catalog",
        return_value="db",
    )

    # Create a mock database that can call the engine spec methods
    def get_all_schema_names_mock(catalog=None):
        if catalog == "other_catalog":
            return ["public", "information_schema"]
        return ["public", "information_schema"]

    def get_all_catalog_names_mock():
        return ["db", "other_catalog"]

    database = Database(
        id=1,
        sqlalchemy_uri="postgresql://localhost/db",
    )
    database.database_name = "my_db"
    # Mock the methods instead of assigning
    mocker.patch.object(database, "get_all_schema_names", get_all_schema_names_mock)
    mocker.patch.object(database, "get_all_catalog_names", get_all_catalog_names_mock)
    session.add(database)
    session.commit()

    # Create initial permissions for testing
    db_perm = ViewMenu(name="[my_db].(id:1)")
    table_perm = ViewMenu(name="[my_db].[my_table](id:1)")
    schema_perm = ViewMenu(name="[my_db].[public]")

    database_access = Permission(name="database_access")
    datasource_access = Permission(name="datasource_access")
    schema_access = Permission(name="schema_access")

    session.add_all(
        [
            db_perm,
            table_perm,
            schema_perm,
            database_access,
            datasource_access,
            schema_access,
        ]
    )
    session.commit()

    # Create permission view associations
    pv1 = PermissionView(permission_id=database_access.id, view_menu_id=db_perm.id)
    pv2 = PermissionView(permission_id=datasource_access.id, view_menu_id=table_perm.id)
    pv3 = PermissionView(permission_id=schema_access.id, view_menu_id=schema_perm.id)
    session.add_all([pv1, pv2, pv3])
    session.commit()

    dataset = SqlaTable(
        id=1,
        database_id=database.id,
        perm="[my_db].[my_table](id:1)",
        catalog=None,
        schema="public",
        catalog_perm=None,
        schema_perm="[my_db].[public]",
    )
    session.add(dataset)
    session.commit()

    chart = Slice(
        datasource_type="table",
        datasource_id=dataset.id,
        catalog_perm=None,
        schema_perm="[my_db].[public]",
    )
    query = Query(
        database_id=database.id,
        catalog=None,
    )
    saved_query = SavedQuery(
        db_id=database.id,
        catalog=None,
    )
    tab_state = TabState(
        database_id=database.id,
        catalog=None,
    )
    table_schema = TableSchema(
        database_id=database.id,
        catalog=None,
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
        id=2,
        database_id=database.id,
        perm="[my_db].[my_table](id:2)",
        catalog="other_catalog",
        schema="public",
        schema_perm="[my_db].[other_catalog].[public]",
        catalog_perm="[my_db].[other_catalog]",
    )
    session.add(new_dataset)
    session.commit()

    # Add permission for the new dataset
    new_table_perm = ViewMenu(name="[my_db].[my_table](id:2)")
    session.add(new_table_perm)
    session.commit()
    pv_new = PermissionView(
        permission_id=datasource_access.id, view_menu_id=new_table_perm.id
    )
    session.add(pv_new)
    session.commit()

    new_chart = Slice(
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

    assert sorted(
        session.query(ViewMenu.name, Permission.name)
        .join(PermissionView, ViewMenu.id == PermissionView.view_menu_id)
        .join(Permission, PermissionView.permission_id == Permission.id)
        .all()
    ) == sorted(
        [
            ("[my_db].(id:1)", "database_access"),
            ("[my_db].[my_table](id:1)", "datasource_access"),
            ("[my_db].[db].[public]", "schema_access"),
            ("[my_db].[db]", "catalog_access"),
            ("[my_db].[other_catalog]", "catalog_access"),
            ("[my_db].[other_catalog].[public]", "schema_access"),
            ("[my_db].[other_catalog].[information_schema]", "schema_access"),
            ("[my_db].[my_table](id:2)", "datasource_access"),
        ]
    )

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
    from superset.migrations.shared.catalogs import (
        Database,
        Query,
        SavedQuery,
        Slice,
        SqlaTable,
        TableSchema,
        TabState,
    )

    engine = session.get_bind()
    Database.metadata.create_all(engine)
    Permission.metadata.create_all(engine)
    PermissionView.metadata.create_all(engine)
    ViewMenu.metadata.create_all(engine)

    mocker.patch("superset.migrations.shared.catalogs.op")
    db = mocker.patch("superset.migrations.shared.catalogs.db")
    db.Session.return_value = session

    # Mock the db_engine_spec to support catalogs but fail on get_all_schema_names
    mock_db_engine_spec = mocker.MagicMock()
    mock_db_engine_spec.supports_catalog = True
    mock_db_engine_spec.get_default_catalog.return_value = "db"

    mocker.patch.object(
        Database,
        "db_engine_spec",
        new_callable=mocker.PropertyMock,
        return_value=mock_db_engine_spec,
    )
    mocker.patch.object(
        Database,
        "get_default_catalog",
        return_value="db",
    )

    def get_all_schema_names_mock(catalog=None):
        raise Exception("Failed to connect to the database")

    mocker.patch.object(
        database,
        "get_all_schema_names",
        side_effect=get_all_schema_names_mock,
    )
    mocker.patch("superset.migrations.shared.catalogs.op", session)

    database = Database(
        id=1,
        sqlalchemy_uri="postgresql://localhost/db",
    )
    database.database_name = "my_db"
    session.add(database)
    session.commit()

    # Create initial permissions for testing
    db_perm = ViewMenu(name="[my_db].(id:1)")
    table_perm = ViewMenu(name="[my_db].[my_table](id:1)")
    schema_perm = ViewMenu(name="[my_db].[public]")

    database_access = Permission(name="database_access")
    datasource_access = Permission(name="datasource_access")
    schema_access = Permission(name="schema_access")

    session.add_all(
        [
            db_perm,
            table_perm,
            schema_perm,
            database_access,
            datasource_access,
            schema_access,
        ]
    )
    session.commit()

    # Create permission view associations
    pv1 = PermissionView(permission_id=database_access.id, view_menu_id=db_perm.id)
    pv2 = PermissionView(permission_id=datasource_access.id, view_menu_id=table_perm.id)
    pv3 = PermissionView(permission_id=schema_access.id, view_menu_id=schema_perm.id)
    session.add_all([pv1, pv2, pv3])
    session.commit()

    dataset = SqlaTable(
        id=1,
        database_id=database.id,
        perm="[my_db].[my_table](id:1)",
        catalog=None,
        schema="public",
        schema_perm="[my_db].[public]",
    )
    session.add(dataset)
    session.commit()

    chart = Slice(
        datasource_type="table",
        datasource_id=dataset.id,
        catalog_perm=None,
        schema_perm="[my_db].[public]",
    )
    query = Query(
        database_id=database.id,
        catalog=None,
    )
    saved_query = SavedQuery(
        db_id=database.id,
        catalog=None,
    )
    tab_state = TabState(
        database_id=database.id,
        catalog=None,
    )
    table_schema = TableSchema(
        database_id=database.id,
        catalog=None,
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
    from superset.migrations.shared.catalogs import (
        Database,
        Query,
        SavedQuery,
        Slice,
        SqlaTable,
        TableSchema,
        TabState,
    )

    engine = session.get_bind()
    Database.metadata.create_all(engine)
    Permission.metadata.create_all(engine)
    PermissionView.metadata.create_all(engine)
    ViewMenu.metadata.create_all(engine)

    mocker.patch("superset.migrations.shared.catalogs.op")
    db = mocker.patch("superset.migrations.shared.catalogs.db")
    db.Session.return_value = session
    add_non_default_catalogs = mocker.patch(
        "superset.migrations.shared.catalogs.add_non_default_catalogs"
    )
    mocker.patch("superset.migrations.shared.catalogs.op", session)

    # Mock the db_engine_spec for BigQuery with catalog support
    mock_db_engine_spec = mocker.MagicMock()
    mock_db_engine_spec.supports_catalog = True
    mock_db_engine_spec.get_default_catalog.return_value = "my-test-project"

    mocker.patch.object(
        Database,
        "db_engine_spec",
        new_callable=mocker.PropertyMock,
        return_value=mock_db_engine_spec,
    )
    mocker.patch.object(
        Database,
        "get_default_catalog",
        return_value="my-test-project",
    )

    database = Database(
        id=1,
        sqlalchemy_uri="bigquery://my-test-project",
        encrypted_extra=json.dumps({"oauth2_client_info": oauth2_config}),
    )
    database.database_name = "my_db"
    session.add(database)
    session.commit()

    # Create initial permissions for testing
    db_perm = ViewMenu(name="[my_db].(id:1)")
    table_perm = ViewMenu(name="[my_db].[my_table](id:1)")
    schema_perm = ViewMenu(name="[my_db].[public]")

    database_access = Permission(name="database_access")
    datasource_access = Permission(name="datasource_access")
    schema_access = Permission(name="schema_access")

    session.add_all(
        [
            db_perm,
            table_perm,
            schema_perm,
            database_access,
            datasource_access,
            schema_access,
        ]
    )
    session.commit()

    # Create permission view associations
    pv1 = PermissionView(permission_id=database_access.id, view_menu_id=db_perm.id)
    pv2 = PermissionView(permission_id=datasource_access.id, view_menu_id=table_perm.id)
    pv3 = PermissionView(permission_id=schema_access.id, view_menu_id=schema_perm.id)
    session.add_all([pv1, pv2, pv3])
    session.commit()

    dataset = SqlaTable(
        id=1,
        database_id=database.id,
        perm="[my_db].[my_table](id:1)",
        catalog=None,
        schema="public",
        schema_perm="[my_db].[public]",
    )
    session.add(dataset)
    session.commit()

    chart = Slice(
        datasource_type="table",
        datasource_id=dataset.id,
        catalog_perm=None,
        schema_perm="[my_db].[public]",
    )
    query = Query(
        database_id=database.id,
        catalog=None,
    )
    saved_query = SavedQuery(
        db_id=database.id,
        catalog=None,
    )
    tab_state = TabState(
        database_id=database.id,
        catalog=None,
    )
    table_schema = TableSchema(
        database_id=database.id,
        catalog=None,
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
    from superset.migrations.shared.catalogs import (
        Database,
        Query,
        SavedQuery,
        Slice,
        SqlaTable,
        TableSchema,
        TabState,
    )

    engine = session.get_bind()
    Database.metadata.create_all(engine)
    Permission.metadata.create_all(engine)
    PermissionView.metadata.create_all(engine)
    ViewMenu.metadata.create_all(engine)

    mocker.patch("superset.migrations.shared.catalogs.op")
    db = mocker.patch("superset.migrations.shared.catalogs.db")
    db.Session.return_value = session
    add_non_default_catalogs = mocker.patch(
        "superset.migrations.shared.catalogs.add_non_default_catalogs"
    )
    mocker.patch("superset.migrations.shared.catalogs.op", session)

    # Mock the db_engine_spec for BigQuery with catalog support
    mock_db_engine_spec = mocker.MagicMock()
    mock_db_engine_spec.supports_catalog = True
    mock_db_engine_spec.get_default_catalog.return_value = "my-test-project"

    mocker.patch.object(
        Database,
        "db_engine_spec",
        new_callable=mocker.PropertyMock,
        return_value=mock_db_engine_spec,
    )
    mocker.patch.object(
        Database,
        "get_default_catalog",
        return_value="my-test-project",
    )

    database = Database(
        id=1,
        sqlalchemy_uri="bigquery://my-test-project",
    )
    database.database_name = "my_db"
    session.add(database)
    session.commit()

    # Create initial permissions for testing
    db_perm = ViewMenu(name="[my_db].(id:1)")
    table_perm = ViewMenu(name="[my_db].[my_table](id:1)")
    schema_perm = ViewMenu(name="[my_db].[public]")

    database_access = Permission(name="database_access")
    datasource_access = Permission(name="datasource_access")
    schema_access = Permission(name="schema_access")
    catalog_access = Permission(name="catalog_access")

    session.add_all(
        [
            db_perm,
            table_perm,
            schema_perm,
            database_access,
            datasource_access,
            schema_access,
            catalog_access,
        ]
    )
    session.commit()

    # Create permission view associations
    pv1 = PermissionView(permission_id=database_access.id, view_menu_id=db_perm.id)
    pv2 = PermissionView(permission_id=datasource_access.id, view_menu_id=table_perm.id)
    pv3 = PermissionView(permission_id=schema_access.id, view_menu_id=schema_perm.id)
    session.add_all([pv1, pv2, pv3])
    session.commit()

    dataset = SqlaTable(
        id=1,
        database_id=database.id,
        perm="[my_db].[my_table](id:1)",
        catalog=None,
        schema="public",
        schema_perm="[my_db].[public]",
    )
    session.add(dataset)
    session.commit()

    chart = Slice(
        datasource_type="table",
        datasource_id=dataset.id,
        catalog_perm=None,
        schema_perm="[my_db].[public]",
    )
    query = Query(
        database_id=database.id,
        catalog=None,
    )
    saved_query = SavedQuery(
        db_id=database.id,
        catalog=None,
    )
    tab_state = TabState(
        database_id=database.id,
        catalog=None,
    )
    table_schema = TableSchema(
        database_id=database.id,
        catalog=None,
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

    with current_app.test_request_context():
        current_app.config["CATALOGS_SIMPLIFIED_MIGRATION"] = True
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
