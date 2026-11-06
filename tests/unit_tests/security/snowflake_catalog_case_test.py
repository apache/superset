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
"""
Catalog-scoped grants on engines whose catalog names are case-insensitive.

Snowflake lists its databases (Superset catalogs) in uppercase, so the
permission sync creates ``[db].[SALES].[schema]``. The default catalog comes
from the connection URI, usually lowercase (``[db].[sales].[schema]``), and
datasets are registered with it. Both spellings name the same Snowflake
database, but the permission checks compared them exactly, so a user granted
the synced schema permission saw no schemas in SQL Lab.

These tests use the real permission sync, real roles and users and the real
security manager; only the live calls that list catalogs and schemas are
mocked.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import TYPE_CHECKING

import pytest
from sqlalchemy.orm.session import Session

from superset import db, security_manager
from superset.exceptions import SupersetSecurityException
from superset.sql.parse import Table
from superset.utils.core import DatasourceName, override_user

if TYPE_CHECKING:
    from flask_appbuilder.security.sqla.models import User
    from pytest_mock import MockerFixture

    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database


DATABASE_NAME = "sales_db"
LISTED_CATALOG = "SALES_DB"  # as Snowflake lists it
URI_CATALOG = "sales_db"  # as the connection URI spells it


@pytest.fixture
def metadata_session(session: Session, mocker: MockerFixture) -> Session:
    """
    The in-memory session, used by the security manager for writes too, so
    the permissions, roles and users created below are real rows.
    """
    from superset.connectors.sqla.models import SqlaTable

    mocker.patch("superset.security.SupersetSecurityManager.session", session)
    SqlaTable.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    return session


@pytest.fixture
def snowflake_database(metadata_session: Session, mocker: MockerFixture) -> Database:
    """
    A Snowflake database whose catalog/schema permissions were created by the
    real permission sync, with Snowflake's uppercase catalog listing.
    """
    from superset.commands.database.utils import add_permissions
    from superset.models.core import Database

    database = Database(
        database_name=DATABASE_NAME,
        sqlalchemy_uri=f"snowflake://user:pass@account/{URI_CATALOG}",
    )
    db.session.add(database)
    db.session.flush()

    mocker.patch.object(
        Database,
        "get_all_catalog_names",
        return_value={LISTED_CATALOG, "OTHER_DB"},
    )
    mocker.patch.object(
        Database,
        "get_all_schema_names",
        return_value={"marts", "finance"},
    )
    mocker.patch.object(Database, "get_default_schema", return_value="public")
    add_permissions(database)
    db.session.flush()
    return database


def _user_with(*grants: tuple[str, str]) -> User:
    """
    A user whose only role holds the given ``(permission, view_menu)`` grants,
    which must already exist (as they would after a permission sync).
    """
    role = security_manager.add_role("dar")
    for permission_name, view_menu_name in grants:
        pvm = security_manager.find_permission_view_menu(
            permission_name, view_menu_name
        )
        assert pvm is not None, f"{permission_name} {view_menu_name} not synced"
        role.permissions.append(pvm)
    user = security_manager.user_model(
        username="analyst",
        first_name="A",
        last_name="B",
        email="analyst@example.com",
        active=True,
        roles=[role],
    )
    db.session.add(user)
    db.session.flush()
    return user


@pytest.fixture
def schema_grant_user(snowflake_database: Database) -> Iterator[User]:
    """A user holding only the synced (uppercase-catalog) schema permission."""
    user = _user_with(
        ("schema_access", f"[{DATABASE_NAME}].[{LISTED_CATALOG}].[marts]"),
    )
    with override_user(user):
        yield user


def _dataset(database: Database, schema: str, catalog: str) -> SqlaTable:
    from superset.connectors.sqla.models import SqlaTable

    dataset = SqlaTable(
        table_name="orders",
        schema=schema,
        catalog=catalog,
        database=database,
    )
    db.session.add(dataset)
    db.session.flush()
    return dataset


def test_sqllab_schema_list_uses_synced_grant(
    snowflake_database: Database,
    schema_grant_user: User,
) -> None:
    """
    SQL Lab asks for the schemas of the default catalog (no catalog selector
    without multi-catalog). The synced grant names the same catalog in
    uppercase, so its schema must be listed.
    """
    assert snowflake_database.get_default_catalog() == URI_CATALOG
    assert security_manager.get_schemas_accessible_by_user(
        snowflake_database,
        None,
        {"marts", "finance"},
    ) == {"marts"}


def test_sqllab_catalog_and_schema_lists_with_multi_catalog(
    snowflake_database: Database,
    schema_grant_user: User,
) -> None:
    """With the catalog selector, the listed catalog and its schema show up."""
    assert security_manager.get_catalogs_accessible_by_user(
        snowflake_database,
        {LISTED_CATALOG, "OTHER_DB"},
    ) == {LISTED_CATALOG}
    assert security_manager.get_schemas_accessible_by_user(
        snowflake_database,
        LISTED_CATALOG,
        {"marts", "finance"},
    ) == {"marts"}


def test_sqllab_table_list_and_table_access(
    snowflake_database: Database,
    schema_grant_user: User,
) -> None:
    """
    After picking the schema, SQL Lab lists its tables and reads their
    metadata, both under the default catalog.
    """
    tables = [
        DatasourceName("orders", "marts", URI_CATALOG),
        DatasourceName("items", "marts", URI_CATALOG),
    ]
    assert (
        security_manager.get_datasources_accessible_by_user(
            snowflake_database,
            tables,
            catalog=None,
            schema="marts",
        )
        == tables
    )
    security_manager.raise_for_access(
        database=snowflake_database,
        table=Table("orders", "marts"),
    )


def test_dataset_in_default_catalog_is_accessible(
    snowflake_database: Database,
    schema_grant_user: User,
) -> None:
    """
    Datasets are registered with the URI catalog, so their schema permission
    is ``[db].[sales_db].[marts]``. The uppercase grant covers them, both in
    the per-dataset check and in the dataset list filter.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.utils.filters import get_dataset_access_filters

    dataset = _dataset(snowflake_database, "marts", URI_CATALOG)
    other = _dataset(snowflake_database, "finance", URI_CATALOG)
    assert dataset.schema_perm == f"[{DATABASE_NAME}].[{URI_CATALOG}].[marts]"

    assert security_manager.can_access_schema(dataset)
    assert not security_manager.can_access_schema(other)
    visible = (
        db.session.query(SqlaTable).filter(get_dataset_access_filters(SqlaTable)).all()
    )
    assert visible == [dataset]


def test_dataset_derived_grant_covers_listed_catalog(
    snowflake_database: Database,
) -> None:
    """
    The reverse direction: a grant on the lowercase permission that datasets
    create also covers the uppercase catalog the multi-catalog selector lists.
    """
    _dataset(snowflake_database, "marts", URI_CATALOG)
    user = _user_with(
        ("schema_access", f"[{DATABASE_NAME}].[{URI_CATALOG}].[marts]"),
    )
    with override_user(user):
        assert security_manager.get_catalogs_accessible_by_user(
            snowflake_database,
            {LISTED_CATALOG, "OTHER_DB"},
        ) == {LISTED_CATALOG}
        assert security_manager.get_schemas_accessible_by_user(
            snowflake_database,
            LISTED_CATALOG,
            {"marts", "finance"},
        ) == {"marts"}


def test_catalog_grant_covers_default_catalog(
    snowflake_database: Database,
) -> None:
    """A synced ``catalog_access`` grant covers the URI spelling of the catalog."""
    user = _user_with(("catalog_access", f"[{DATABASE_NAME}].[{LISTED_CATALOG}]"))
    with override_user(user):
        assert security_manager.can_access_catalog(snowflake_database, URI_CATALOG)
        assert security_manager.get_schemas_accessible_by_user(
            snowflake_database,
            None,
            {"marts", "finance"},
        ) == {"marts", "finance"}
        assert not security_manager.can_access_catalog(snowflake_database, "OTHER_DB")


def test_catalog_list_with_dataset_access(
    snowflake_database: Database,
) -> None:
    """
    The catalog list for a user who only holds dataset access returns the
    dataset's catalog (it used to read ``catalog`` off a row that only
    selected ``schema``).
    """
    dataset = _dataset(snowflake_database, "marts", URI_CATALOG)
    user = _user_with(("datasource_access", dataset.perm))
    with override_user(user):
        assert security_manager.get_catalogs_accessible_by_user(
            snowflake_database,
            {LISTED_CATALOG, "OTHER_DB"},
        ) == {LISTED_CATALOG}


def test_case_folding_does_not_widen_the_grant(
    snowflake_database: Database,
    schema_grant_user: User,
) -> None:
    """
    Only the catalog's case is ignored. Another schema, a schema that differs
    by case, another catalog, the whole catalog and the whole database stay
    denied.
    """
    sm = security_manager
    assert (
        sm.get_schemas_accessible_by_user(
            snowflake_database, "OTHER_DB", {"marts", "finance"}
        )
        == set()
    )
    assert (
        sm.get_schemas_accessible_by_user(
            snowflake_database, None, {"MARTS", "finance"}
        )
        == set()
    )
    assert not sm.can_access_catalog(snowflake_database, URI_CATALOG)
    assert not sm.can_access_database(snowflake_database)

    def can_access_schema_perm(view_name: str) -> bool:
        return sm.can_access_catalog_scoped(
            snowflake_database, "schema_access", view_name
        )

    assert can_access_schema_perm(f"[{DATABASE_NAME}].[{URI_CATALOG}].[marts]")
    assert can_access_schema_perm(f"[{DATABASE_NAME}].[Sales_Db].[marts]")
    assert not can_access_schema_perm(f"[{DATABASE_NAME}].[{URI_CATALOG}].[finance]")
    assert not can_access_schema_perm(f"[{DATABASE_NAME}].[{URI_CATALOG}].[MARTS]")
    assert not can_access_schema_perm(f"[{DATABASE_NAME}].[{URI_CATALOG}2].[marts]")
    assert not can_access_schema_perm(f"[{DATABASE_NAME}].[OTHER_DB].[marts]")
    assert not can_access_schema_perm(
        f"[{DATABASE_NAME.upper()}].[{URI_CATALOG}].[marts]"
    )
    assert not can_access_schema_perm(f"[{DATABASE_NAME}].[marts]")
    assert not sm.can_access_catalog_scoped(
        snowflake_database, "catalog_access", f"[{DATABASE_NAME}].[{URI_CATALOG}]"
    )
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(
            database=snowflake_database,
            table=Table("orders", "finance"),
        )


def test_case_sensitive_engine_still_matches_exactly(
    metadata_session: Session,
    mocker: MockerFixture,
) -> None:
    """
    Engines without case-insensitive catalogs keep exact matching: on
    Postgres ``SALES_DB`` and ``sales_db`` are two different catalogs.
    """
    from superset.commands.database.utils import add_permissions
    from superset.models.core import Database

    database = Database(
        database_name=DATABASE_NAME,
        sqlalchemy_uri=f"postgresql://user:pass@host/{URI_CATALOG}",
        extra='{"allow_multi_catalog": true}',
    )
    db.session.add(database)
    db.session.flush()
    mocker.patch.object(
        Database, "get_all_catalog_names", return_value={LISTED_CATALOG}
    )
    mocker.patch.object(Database, "get_all_schema_names", return_value={"marts"})
    mocker.patch.object(Database, "get_default_schema", return_value="public")
    add_permissions(database)
    db.session.flush()

    user = _user_with(
        ("schema_access", f"[{DATABASE_NAME}].[{LISTED_CATALOG}].[marts]"),
    )
    with override_user(user):
        assert (
            security_manager.get_schemas_accessible_by_user(database, None, {"marts"})
            == set()
        )
        assert not security_manager.can_access_catalog_scoped(
            database,
            "schema_access",
            f"[{DATABASE_NAME}].[{URI_CATALOG}].[marts]",
        )
        assert security_manager.user_view_menu_names("schema_access") == {
            f"[{DATABASE_NAME}].[{LISTED_CATALOG}].[marts]"
        }
