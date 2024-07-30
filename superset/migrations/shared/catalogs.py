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

from __future__ import annotations

import logging
from typing import Any, Type

import sqlalchemy as sa
from alembic import op
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session

from superset import db, security_manager
from superset.db_engine_specs.base import GenericDBException
from superset.migrations.shared.security_converge import (
    add_pvms,
    Permission,
    PermissionView,
    ViewMenu,
)
from superset.models.core import Database

logger = logging.getLogger(__name__)


Base: Type[Any] = declarative_base()


class SqlaTable(Base):
    __tablename__ = "tables"

    id = sa.Column(sa.Integer, primary_key=True)
    database_id = sa.Column(sa.Integer, nullable=False)
    perm = sa.Column(sa.String(1000))
    schema_perm = sa.Column(sa.String(1000))
    catalog_perm = sa.Column(sa.String(1000), nullable=True, default=None)
    schema = sa.Column(sa.String(255))
    catalog = sa.Column(sa.String(256), nullable=True, default=None)


class Query(Base):
    __tablename__ = "query"

    id = sa.Column(sa.Integer, primary_key=True)
    database_id = sa.Column(sa.Integer, nullable=False)
    catalog = sa.Column(sa.String(256), nullable=True, default=None)


class SavedQuery(Base):
    __tablename__ = "saved_query"

    id = sa.Column(sa.Integer, primary_key=True)
    db_id = sa.Column(sa.Integer, nullable=False)
    catalog = sa.Column(sa.String(256), nullable=True, default=None)


class TabState(Base):
    __tablename__ = "tab_state"

    id = sa.Column(sa.Integer, primary_key=True)
    database_id = sa.Column(sa.Integer, nullable=False)
    catalog = sa.Column(sa.String(256), nullable=True, default=None)


class TableSchema(Base):
    __tablename__ = "table_schema"

    id = sa.Column(sa.Integer, primary_key=True)
    database_id = sa.Column(sa.Integer, nullable=False)
    catalog = sa.Column(sa.String(256), nullable=True, default=None)


class Slice(Base):
    __tablename__ = "slices"

    id = sa.Column(sa.Integer, primary_key=True)
    datasource_id = sa.Column(sa.Integer)
    datasource_type = sa.Column(sa.String(200))
    catalog_perm = sa.Column(sa.String(1000), nullable=True, default=None)
    schema_perm = sa.Column(sa.String(1000))


def get_known_schemas(database_name: str, session: Session) -> list[str]:
    """
    Read all known schemas from the existing schema permissions.
    """
    names = (
        session.query(ViewMenu.name)
        .join(PermissionView, ViewMenu.id == PermissionView.view_menu_id)
        .join(Permission, PermissionView.permission_id == Permission.id)
        .filter(
            ViewMenu.name.like(f"[{database_name}]%"),
            Permission.name == "schema_access",
        )
        .all()
    )
    return sorted({name[0][1:-1].split("].[")[-1] for name in names})


def upgrade_catalog_perms(engines: set[str] | None = None) -> None:
    """
    Update models and permissions when catalogs are introduced in a DB engine spec.

    When an existing DB engine spec starts to support catalogs we need to:

        - Add `catalog_access` permissions for each catalog.
        - Rename existing `schema_access` permissions to include the default catalog.
        - Create `schema_access` permissions for each schema in the new catalogs.

    Also, for all the relevant existing models we need to:

        - Populate the `catalog` field with the default catalog.
        - Update `schema_perm` to include the default catalog.
        - Populate `catalog_perm` to include the default catalog.

    """
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for database in session.query(Database).all():
        db_engine_spec = database.db_engine_spec
        if (
            engines and db_engine_spec.engine not in engines
        ) or not db_engine_spec.supports_catalog:
            continue

        # For some databases, fetching the default catalog requires a connection to the
        # analytical DB. If we can't connect to the analytical DB during the migration
        # we should stop it, since we need the default catalog in order to update
        # existing models.
        if default_catalog := database.get_default_catalog():
            upgrade_database_catalogs(database, default_catalog, session)

    session.flush()


def upgrade_database_catalogs(
    database: Database,
    default_catalog: str,
    session: Session,
) -> None:
    """
    Upgrade a given database to support the default catalog.
    """
    catalog_perm = security_manager.get_catalog_perm(
        database.database_name,
        default_catalog,
    )
    pvms: dict[str, tuple[str, ...]] = {catalog_perm: ("catalog_access",)}

    # rename existing schema permissions to include the catalog, and also find any new
    # schemas
    new_schema_pvms = upgrade_schema_perms(database, default_catalog, session)
    pvms.update(new_schema_pvms)

    # update existing models that have a `catalog` column so it points to the default
    # catalog
    models = [
        (Query, "database_id"),
        (SavedQuery, "db_id"),
        (TabState, "database_id"),
        (TableSchema, "database_id"),
    ]
    for model, column in models:
        for instance in session.query(model).filter(
            getattr(model, column) == database.id
        ):
            instance.catalog = default_catalog

    # update `schema_perm` and `catalog_perm` for tables and charts
    for table in session.query(SqlaTable).filter_by(
        database_id=database.id,
        catalog=None,
    ):
        schema_perm = security_manager.get_schema_perm(
            database.database_name,
            default_catalog,
            table.schema,
        )

        table.catalog = default_catalog
        table.catalog_perm = catalog_perm
        table.schema_perm = schema_perm

        for chart in session.query(Slice).filter_by(
            datasource_id=table.id,
            datasource_type="table",
        ):
            chart.catalog_perm = catalog_perm
            chart.schema_perm = schema_perm

    # add any new catalogs discovered and their schemas
    new_catalog_pvms = add_non_default_catalogs(database, default_catalog, session)
    pvms.update(new_catalog_pvms)

    # add default catalog permission and permissions for any new found schemas, and also
    # permissions for new catalogs and their schemas
    add_pvms(session, pvms)


def add_non_default_catalogs(
    database: Database,
    default_catalog: str,
    session: Session,
) -> dict[str, tuple[str]]:
    """
    Add permissions for additional catalogs and their schemas.
    """
    try:
        catalogs = {
            catalog
            for catalog in database.get_all_catalog_names()
            if catalog != default_catalog
        }
    except GenericDBException:
        # If we can't connect to the analytical DB to fetch the catalogs we should just
        # return. The catalog and schema permissions can be created later when the DB is
        # edited.
        return {}

    pvms = {}
    for catalog in catalogs:
        perm = security_manager.get_catalog_perm(database.database_name, catalog)
        pvms[perm] = ("catalog_access",)

        new_schema_pvms = create_schema_perms(database, catalog, session)
        pvms.update(new_schema_pvms)

    return pvms


def upgrade_schema_perms(
    database: Database,
    default_catalog: str,
    session: Session,
) -> dict[str, tuple[str]]:
    """
    Rename existing schema permissions to include the catalog.

    Schema permissions are stored (and processed) as strings, in the form:

        [database_name].[schema_name]

    When catalogs are first introduced for a DB engine spec we need to rename any
    existing permissions to the form:

        [database_name].[default_catalog_name].[schema_name]

    """
    schemas = get_known_schemas(database.database_name, session)

    perms = {}
    for schema in schemas:
        current_perm = security_manager.get_schema_perm(
            database.database_name,
            None,
            schema,
        )
        new_perm = security_manager.get_schema_perm(
            database.database_name,
            default_catalog,
            schema,
        )

        if (
            existing_pvm := session.query(ViewMenu)
            .filter_by(name=current_perm)
            .one_or_none()
        ):
            existing_pvm.name = new_perm
        else:
            # new schema discovered, need to create a new permission
            perms[new_perm] = ("schema_access",)

    return perms


def create_schema_perms(
    database: Database,
    catalog: str,
    session: Session,
) -> dict[str, tuple[str]]:
    """
    Create schema permissions for a given catalog.
    """
    try:
        schemas = database.get_all_schema_names(catalog=catalog)
    except GenericDBException:
        # If we can't connect to the analytical DB to fetch schemas in this catalog we
        # should just return. The schema permissions can be created when the DB is
        # edited.
        return {}

    return {
        security_manager.get_schema_perm(
            database.database_name,
            catalog,
            schema,
        ): ("schema_access",)
        for schema in schemas
    }


def downgrade_catalog_perms(engines: set[str] | None = None) -> None:
    """
    Reverse the process of `upgrade_catalog_perms`.

    This should:

        - Delete all `catalog_access` permissions.
        - Rename `schema_access` permissions in the default catalog to omit it.
        - Delete `schema_access` permissions for schemas not in the default catalog.

    Also, for models in the default catalog we should:

        - Populate the `catalog` field with `None`.
        - Update `schema_perm` to omit the default catalog.
        - Populate the `catalog_perm` field with `None`.

    WARNING: models (datasets and charts) not in the default catalog are deleted!
    """
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for database in session.query(Database).all():
        db_engine_spec = database.db_engine_spec
        if (
            engines and db_engine_spec.engine not in engines
        ) or not db_engine_spec.supports_catalog:
            continue

        if default_catalog := database.get_default_catalog():
            downgrade_database_catalogs(database, default_catalog, session)

    session.flush()


def downgrade_database_catalogs(
    database: Database,
    default_catalog: str,
    session: Session,
) -> None:
    # remove all catalog permissions associated with the DB
    prefix = f"[{database.database_name}].%"
    for pvm in (
        session.query(PermissionView)
        .join(Permission, PermissionView.permission_id == Permission.id)
        .join(ViewMenu, PermissionView.view_menu_id == ViewMenu.id)
        .filter(
            Permission.name == "catalog_access",
            ViewMenu.name.like(prefix),
        )
        .all()
    ):
        session.delete(pvm)
        session.delete(pvm.view_menu)

    # rename existing schemas permissions to omit the catalog, and remove schema
    # permissions associated with other catalogs
    downgrade_schema_perms(database, default_catalog, session)

    # update existing models
    models = [
        (Query, "database_id"),
        (SavedQuery, "db_id"),
        (TabState, "database_id"),
        (TableSchema, "database_id"),
    ]
    for model, column in models:
        for instance in session.query(model).filter(
            getattr(model, column) == database.id,
            model.catalog == default_catalog,  # type: ignore
        ):
            instance.catalog = None

    # update `schema_perm` for tables and charts
    for table in session.query(SqlaTable).filter_by(
        database_id=database.id,
        catalog=default_catalog,
    ):
        schema_perm = security_manager.get_schema_perm(
            database.database_name,
            None,
            table.schema,
        )

        table.catalog = None
        table.catalog_perm = None
        table.schema_perm = schema_perm

        for chart in session.query(Slice).filter_by(
            datasource_id=table.id,
            datasource_type="table",
        ):
            chart.catalog_perm = None
            chart.schema_perm = schema_perm

    # delete models referencing non-default catalogs
    for model, column in models:
        for instance in session.query(model).filter(
            getattr(model, column) == database.id,
            model.catalog != default_catalog,  # type: ignore
        ):
            session.delete(instance)

    # delete datasets and any associated permissions
    for table in session.query(SqlaTable).filter(
        SqlaTable.database_id == database.id,
        SqlaTable.catalog != default_catalog,
    ):
        for chart in session.query(Slice).filter(
            Slice.datasource_id == table.id,
            Slice.datasource_type == "table",
        ):
            session.delete(chart)

        session.delete(table)
        pvm = (
            session.query(PermissionView)
            .join(Permission, PermissionView.permission_id == Permission.id)
            .join(ViewMenu, PermissionView.view_menu_id == ViewMenu.id)
            .filter(
                Permission.name == "datasource_access",
                ViewMenu.name == table.perm,
            )
            .one()
        )
        session.delete(pvm)
        session.delete(pvm.view_menu)

    session.flush()


def downgrade_schema_perms(
    database: Database,
    default_catalog: str,
    session: Session,
) -> None:
    """
    Rename default catalog schema permissions and delete other schema permissions.
    """
    prefix = f"[{database.database_name}].%"
    pvms = (
        session.query(PermissionView)
        .join(Permission, PermissionView.permission_id == Permission.id)
        .join(ViewMenu, PermissionView.view_menu_id == ViewMenu.id)
        .filter(
            Permission.name == "schema_access",
            ViewMenu.name.like(prefix),
        )
        .all()
    )

    pvms_to_delete = []
    pvms_to_rename = []
    for pvm in pvms:
        parts = pvm.view_menu.name[1:-1].split("].[")
        if len(parts) != 3:
            logger.warning(
                "Invalid schema permission: %s. Please fix manually",
                pvm.view_menu.name,
            )
            continue

        database_name, catalog, schema = parts

        if catalog == default_catalog:
            new_name = security_manager.get_schema_perm(
                database_name,
                None,
                schema,
            )
            pvms_to_rename.append((pvm, new_name))
        else:
            # non-default catalog, delete schema perm
            pvms_to_delete.append(pvm)

    for pvm in pvms_to_delete:
        session.delete(pvm)
        session.delete(pvm.view_menu)

    for pvm, new_name in pvms_to_rename:
        pvm.view_menu.name = new_name
