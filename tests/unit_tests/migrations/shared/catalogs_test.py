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

import logging
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.migrations.shared import catalogs
from superset.migrations.shared.catalogs import (
    CatalogRequiresConnectionError,
    Database,
    downgrade_catalog_perms,
    get_default_catalog,
    parse_database_uri,
    Query,
    SavedQuery,
    Slice,
    SqlaTable,
    TableSchema,
    TabState,
    upgrade_catalog_perms,
)
from superset.migrations.shared.security_converge import (
    Base as SecurityBase,
    Permission,
    PermissionView,
    Role,
    ViewMenu,
)


@pytest.mark.parametrize(
    "sqlalchemy_uri, extra, expected",
    [
        ("postgresql://user:XXXXXXXXXX@host:5432/db", None, "db"),
        ("postgresql+psycopg2://host/db", None, "db"),
        ("postgres://host/db", None, "db"),
        ("postgresql://host", None, None),
        ("trino://host:8080/hive", None, "hive"),
        ("trino://host:8080/hive/default", None, "hive"),
        ("trino://host:8080", None, None),
        ("presto://host:8080/hive/default", None, "hive"),
        (
            "snowflake://user:XXXXXXXXXX@account/MY_DB/PUBLIC?warehouse=wh",
            None,
            "MY_DB",
        ),
        ("snowflake://user@account", None, None),
        ("bigquery://my-project", None, "my-project"),
        ("bigquery:///my-project", None, "my-project"),
        # project inferred from the credentials, which needs a connection
        ("bigquery://", '{"engine_params": {}}', CatalogRequiresConnectionError),
        (
            "databricks://token:XXXXXXXXXX@host:443?http_path=/sql&catalog=main",
            None,
            "main",
        ),
        ("databricks://token:XXXXXXXXXX@host:443?http_path=/sql", None, None),
        (
            "databricks+connector://token:XXXXXXXXXX@host:443/default",
            '{"engine_params": {"connect_args": {"catalog": "main"}}}',
            "main",
        ),
        # catalog resolved by querying the database
        (
            "databricks+connector://token:XXXXXXXXXX@host:443/default",
            '{"engine_params": {"connect_args": {"http_path": "/sql"}}}',
            CatalogRequiresConnectionError,
        ),
        (
            "databricks+connector://token:XXXXXXXXXX@host:443/default",
            None,
            CatalogRequiresConnectionError,
        ),
        (
            "databricks+connector://token:XXXXXXXXXX@host:443/default",
            "{bad",
            CatalogRequiresConnectionError,
        ),
        (
            "databricks+pyhive://token:XXXXXXXXXX@host:443/hive_metastore?http_path=/x",
            None,
            "hive_metastore",
        ),
        (
            "databricks+pyhive://token:XXXXXXXXXX@host:443/main/default?http_path=/x",
            None,
            "main",
        ),
        ("databricks+pyhive://token:XXXXXXXXXX@host:443", None, None),
        # Databricks drivers without catalog support
        (
            "databricks+pyodbc://token:XXXXXXXXXX@host:443/default?catalog=main",
            None,
            None,
        ),
    ],
)
def test_get_default_catalog(
    sqlalchemy_uri: str,
    extra: str | None,
    expected: str | type[Exception] | None,
) -> None:
    """
    The default catalog is derived from the stored URI and plain-text ``extra``,
    matching how each engine spec resolves it when no connection is needed, and
    flagged when the engine spec would need a connection.
    """
    database = Database(database_name="db", sqlalchemy_uri=sqlalchemy_uri, extra=extra)
    result = parse_database_uri(database)
    assert result is not None
    engine, url = result
    if expected is CatalogRequiresConnectionError:
        with pytest.raises(CatalogRequiresConnectionError):
            get_default_catalog(database, engine, url)
    else:
        assert get_default_catalog(database, engine, url) == expected


@pytest.fixture
def migration_session(mocker: MockerFixture, session: Session) -> Session:
    """
    A metadata DB used by the migration helpers, with live connections disabled.
    """
    engine = session.get_bind()
    catalogs.Base.metadata.create_all(engine)
    SecurityBase.metadata.create_all(engine)

    mocker.patch("superset.migrations.shared.catalogs.op")
    db = mocker.patch("superset.migrations.shared.catalogs.db")
    db.Session.return_value = session

    # the migration must never connect to an analytical database
    no_connection = AssertionError("migration must not connect to a database")
    mocker.patch("sqlalchemy.create_engine", side_effect=no_connection)
    from superset.models.core import Database as LiveDatabase

    for method in (
        "get_sqla_engine",
        "get_inspector",
        "get_default_catalog",
        "get_all_catalog_names",
        "get_all_schema_names",
    ):
        mocker.patch.object(LiveDatabase, method, side_effect=no_connection)

    return session


def add_database(
    session: Session,
    id_: int,
    name: str,
    sqlalchemy_uri: str,
    extra: str | None = None,
    schema: str = "public",
) -> None:
    """
    Add a database with a dataset, a chart, SQL Lab models, and a schema
    permission granted to a role.
    """
    session.add(
        Database(
            id=id_,
            database_name=name,
            sqlalchemy_uri=sqlalchemy_uri,
            extra=extra,
        )
    )
    session.add(
        SqlaTable(
            id=id_,
            database_id=id_,
            schema=schema,
            perm=f"[{name}].[my_table](id:{id_})",
            schema_perm=f"[{name}].[{schema}]",
        )
    )
    session.add(
        Slice(
            id=id_,
            datasource_id=id_,
            datasource_type="table",
            schema_perm=f"[{name}].[{schema}]",
        )
    )
    session.add_all(
        [
            Query(id=id_, database_id=id_),
            SavedQuery(id=id_, db_id=id_),
            TabState(id=id_, database_id=id_),
            TableSchema(id=id_, database_id=id_),
        ]
    )

    schema_access = session.query(Permission).filter_by(
        name="schema_access"
    ).one_or_none() or Permission(name="schema_access")
    pvm = PermissionView(
        permission=schema_access,
        view_menu=ViewMenu(name=f"[{name}].[{schema}]"),
    )
    role = session.query(Role).filter_by(name="Gamma").one_or_none() or Role(
        name="Gamma"
    )
    role.permissions.append(pvm)
    session.add(role)
    session.commit()


def get_state(session: Session, database_id: int) -> dict[str, Any]:
    session.expire_all()
    table = session.get(SqlaTable, database_id)
    chart = session.get(Slice, database_id)
    return {
        "table": (table.catalog, table.catalog_perm, table.schema_perm),
        "chart": (chart.catalog_perm, chart.schema_perm),
        "sqllab": [
            session.get(model, database_id).catalog
            for model in (Query, SavedQuery, TabState, TableSchema)
        ],
    }


def get_perms(session: Session) -> set[tuple[str, str]]:
    return {
        tuple(row)
        for row in session.query(ViewMenu.name, Permission.name)
        .join(PermissionView, ViewMenu.id == PermissionView.view_menu_id)
        .join(Permission, PermissionView.permission_id == Permission.id)
    }


def get_role_perms(session: Session) -> set[str]:
    role = session.query(Role).filter_by(name="Gamma").one()
    return {pvm.view_menu.name for pvm in role.permissions}


ORIGINAL_STATE = {
    "table": (None, None, "[my_db].[public]"),
    "chart": (None, "[my_db].[public]"),
    "sqllab": [None, None, None, None],
}


def test_upgrade_and_downgrade_catalog_perms(migration_session: Session) -> None:
    """
    The upgrade backfills the default catalog derived from the URI and keeps the
    renamed schema permission granted; the downgrade reverses it.
    """
    session = migration_session
    add_database(session, 1, "my_db", "postgresql://user:XXXXXXXXXX@host/db")
    assert get_state(session, 1) == ORIGINAL_STATE

    upgrade_catalog_perms(engines={"postgresql"})
    session.commit()

    assert get_state(session, 1) == {
        "table": ("db", "[my_db].[db]", "[my_db].[db].[public]"),
        "chart": ("[my_db].[db]", "[my_db].[db].[public]"),
        "sqllab": ["db", "db", "db", "db"],
    }
    assert get_perms(session) == {
        ("[my_db].[db].[public]", "schema_access"),
        ("[my_db].[db]", "catalog_access"),
    }
    assert get_role_perms(session) == {"[my_db].[db].[public]"}

    downgrade_catalog_perms(engines={"postgresql"})
    session.commit()

    assert get_state(session, 1) == ORIGINAL_STATE
    assert get_perms(session) == {("[my_db].[public]", "schema_access")}
    assert get_role_perms(session) == {"[my_db].[public]"}


def test_upgrade_catalog_perms_preserves_existing_catalogs(
    migration_session: Session,
) -> None:
    """
    Rows in another catalog keep it on upgrade and downgrade.
    """
    session = migration_session
    add_database(session, 1, "my_db", "postgresql://host/db")
    session.get(Query, 1).catalog = "other"
    session.add(
        SqlaTable(
            id=2,
            database_id=1,
            schema="public",
            catalog="other",
            catalog_perm="[my_db].[other]",
            schema_perm="[my_db].[other].[public]",
        )
    )
    session.commit()

    upgrade_catalog_perms(engines={"postgresql"})
    session.commit()

    assert get_state(session, 1)["sqllab"] == ["other", "db", "db", "db"]

    downgrade_catalog_perms(engines={"postgresql"})
    session.commit()

    assert get_state(session, 1)["sqllab"] == ["other", None, None, None]
    table = session.get(SqlaTable, 2)
    assert (table.catalog, table.catalog_perm, table.schema_perm) == (
        "other",
        "[my_db].[other]",
        "[my_db].[other].[public]",
    )


@pytest.mark.parametrize(
    "name, sqlalchemy_uri, extra, message",
    [
        (
            "bigquery_no_project",
            "bigquery://",
            None,
            "its default catalog can't be determined without connecting to it",
        ),
        (
            "databricks_connector_no_catalog",
            "databricks+connector://token:XXXXXXXXXX@host:443/default",
            '{"engine_params": {"connect_args": {}}}',
            "its default catalog can't be determined without connecting to it",
        ),
        ("invalid_uri", "not a uri", None, "invalid SQLAlchemy URI"),
    ],
)
def test_catalog_perms_skip_underivable_catalog(
    migration_session: Session,
    caplog: pytest.LogCaptureFixture,
    name: str,
    sqlalchemy_uri: str,
    extra: str | None,
    message: str,
) -> None:
    """
    Databases whose default catalog can't be derived without a connection are left
    untouched, with a warning naming the operation.
    """
    session = migration_session
    add_database(session, 1, name, sqlalchemy_uri, extra)
    state = get_state(session, 1)
    perms = get_perms(session)

    upgrade_catalog_perms()
    downgrade_catalog_perms()
    session.commit()

    assert get_state(session, 1) == state
    assert get_perms(session) == perms
    warnings = [r.getMessage() for r in caplog.records if r.levelname == "WARNING"]
    assert len(warnings) == 2
    assert warnings[0].startswith(
        f"Skipping catalog backfill for database {name}: {message}"
    )
    assert warnings[1].startswith(
        f"Skipping catalog rollback for database {name}: {message}"
    )


@pytest.mark.parametrize(
    "name, sqlalchemy_uri",
    [
        ("databricks_no_catalog", "databricks://token:XXXXXXXXXX@host:443"),
        ("postgres_no_database", "postgresql://host"),
        ("trino_no_catalog", "trino://host:8080"),
    ],
)
def test_catalog_perms_skip_databases_without_default_catalog(
    migration_session: Session,
    caplog: pytest.LogCaptureFixture,
    name: str,
    sqlalchemy_uri: str,
) -> None:
    """
    Databases without a default catalog are left untouched without a warning,
    since their permissions don't change when catalogs are enabled.
    """
    caplog.set_level(logging.INFO, logger="alembic.env")
    session = migration_session
    add_database(session, 1, name, sqlalchemy_uri)
    state = get_state(session, 1)
    perms = get_perms(session)

    upgrade_catalog_perms()
    downgrade_catalog_perms()
    session.commit()

    assert get_state(session, 1) == state
    assert get_perms(session) == perms
    assert not [r for r in caplog.records if r.levelname == "WARNING"]
    assert f"Skipping catalog backfill for database {name}: no default catalog" in (
        caplog.text
    )


def test_upgrade_catalog_perms_databricks_pyhive(migration_session: Session) -> None:
    """
    Databricks over PyHive takes its default catalog from the URI.
    """
    session = migration_session
    add_database(
        session,
        1,
        "my_databricks",
        "databricks+pyhive://token:XXXXXXXXXX@host:443/hive_metastore?http_path=/x",
    )

    upgrade_catalog_perms(engines={"databricks"})
    session.commit()

    assert get_state(session, 1)["table"] == (
        "hive_metastore",
        "[my_databricks].[hive_metastore]",
        "[my_databricks].[hive_metastore].[public]",
    )
    assert get_role_perms(session) == {"[my_databricks].[hive_metastore].[public]"}


def test_catalog_perms_only_touch_given_engines(migration_session: Session) -> None:
    """
    Each migration only backfills the engines it enables catalogs for, and engines
    without catalog support are never touched.
    """
    session = migration_session
    add_database(session, 1, "my_postgres", "postgresql://host/db")
    add_database(session, 2, "my_trino", "trino://host:8080/hive/default")
    add_database(session, 3, "my_mysql", "mysql://host/db")
    before = {id_: get_state(session, id_) for id_ in (1, 2, 3)}

    upgrade_catalog_perms(engines={"trino", "presto", "bigquery", "snowflake"})
    session.commit()

    assert get_state(session, 1) == before[1]
    assert get_state(session, 2)["table"] == (
        "hive",
        "[my_trino].[hive]",
        "[my_trino].[hive].[public]",
    )
    assert get_state(session, 3) == before[3]
    assert get_perms(session) == {
        ("[my_postgres].[public]", "schema_access"),
        ("[my_trino].[hive].[public]", "schema_access"),
        ("[my_trino].[hive]", "catalog_access"),
        ("[my_mysql].[public]", "schema_access"),
    }


def test_upgrade_catalog_perms_does_not_rename_other_databases(
    migration_session: Session,
) -> None:
    """
    Schema permissions are matched on the exact database name, even when it
    contains LIKE wildcards.
    """
    session = migration_session
    add_database(session, 1, "my_db", "postgresql://host/db")
    add_database(session, 2, "myXdb", "mysql://host/db", schema="sales")

    upgrade_catalog_perms(engines={"postgresql"})
    session.commit()

    perms = get_perms(session)
    assert ("[myXdb].[sales]", "schema_access") in perms
    assert ("[my_db].[db].[sales]", "schema_access") not in perms


def test_catalog_perms_do_not_use_live_models() -> None:
    """
    The helpers are pinned to local models rather than the live ``Database`` model,
    DB engine specs or security manager.
    """
    from superset.models.core import Database as LiveDatabase

    assert catalogs.Database is not LiveDatabase
    assert not hasattr(catalogs, "security_manager")
    assert not hasattr(catalogs, "current_app")
