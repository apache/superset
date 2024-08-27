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
from datetime import datetime
from typing import Any, Type, Union

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

logger = logging.getLogger("alembic")

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


ModelType = Union[Type[Query], Type[SavedQuery], Type[TabState], Type[TableSchema]]

MODELS: list[tuple[ModelType, str]] = [
    (Query, "database_id"),
    (SavedQuery, "db_id"),
    (TabState, "database_id"),
    (TableSchema, "database_id"),
]


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


def get_batch_size(session: Session) -> int:
    max_sqlite_in = 999
    return max_sqlite_in if session.bind.dialect.name == "sqlite" else 1_000_000


def print_processed_batch(
    start_time: datetime,
    offset: int,
    total_rows: int,
    model: ModelType,
    batch_size: int,
) -> None:
    """
    Print the progress of batch processing.

    This function logs the progress of processing a batch of rows from a model.
    It calculates the elapsed time since the start of the batch processing and
    logs the number of rows processed along with the percentage completion.

    Parameters:
        start_time (datetime): The start time of the batch processing.
        offset (int): The current offset in the batch processing.
        total_rows (int): The total number of rows to process.
        model (ModelType): The model being processed.
        batch_size (int): The size of the batch being processed.
    """
    elapsed_time = datetime.now() - start_time
    elapsed_seconds = elapsed_time.total_seconds()
    elapsed_formatted = f"{int(elapsed_seconds // 3600):02}:{int((elapsed_seconds % 3600) // 60):02}:{int(elapsed_seconds % 60):02}"
    rows_processed = min(offset + batch_size, total_rows)
    logger.info(
        f"{elapsed_formatted} - {rows_processed:,} of {total_rows:,} {model.__tablename__} rows processed "
        f"({(rows_processed / total_rows) * 100:.2f}%)"
    )


def update_catalog_column(
    session: Session, database: Database, catalog: str, downgrade: bool = False
) -> None:
    """
    Update the `catalog` column in the specified models to the given catalog.

    This function iterates over a list of models defined by MODELS and updates
    the `catalog` columnto the specified catalog or None depending on the downgrade
    parameter. The update is performed in batches to optimize performance and reduce
    memory usage.

    Parameters:
        session (Session): The SQLAlchemy session to use for database operations.
        database (Database): The database instance containing the models to update.
        catalog (Catalog): The new catalog value to set in the `catalog` column or
            the default catalog if `downgrade` is True.
        downgrade (bool): If True, the `catalog` column is set to None where the
            catalog matches the specified catalog.
    """
    start_time = datetime.now()

    logger.info(f"Updating {database.database_name} models to catalog {catalog}")

    for model, column in MODELS:
        # Get the total number of rows that match the condition
        total_rows = (
            session.query(sa.func.count(model.id))
            .filter(getattr(model, column) == database.id)
            .filter(model.catalog == catalog if downgrade else True)
            .scalar()
        )

        logger.info(
            f"Total rows to be processed for {model.__tablename__}: {total_rows:,}"
        )

        batch_size = get_batch_size(session)
        limit_value = min(batch_size, total_rows)

        # Update in batches using row numbers
        for i in range(0, total_rows, batch_size):
            subquery = (
                session.query(model.id)
                .filter(getattr(model, column) == database.id)
                .filter(model.catalog == catalog if downgrade else True)
                .order_by(model.id)
                .offset(i)
                .limit(limit_value)
                .subquery()
            )

            # SQLite does not support multiple-table criteria within UPDATE
            if session.bind.dialect.name == "sqlite":
                ids_to_update = [row.id for row in session.query(subquery.c.id).all()]
                if ids_to_update:
                    session.execute(
                        sa.update(model)
                        .where(model.id.in_(ids_to_update))
                        .values(catalog=None if downgrade else catalog)
                        .execution_options(synchronize_session=False)
                    )
            else:
                session.execute(
                    sa.update(model)
                    .where(model.id == subquery.c.id)
                    .values(catalog=None if downgrade else catalog)
                    .execution_options(synchronize_session=False)
                )

            print_processed_batch(start_time, i, total_rows, model, batch_size)


def update_schema_catalog_perms(
    session: Session,
    database: Database,
    catalog_perm: str | None,
    catalog: str,
    downgrade: bool = False,
) -> None:
    """
    Update schema and catalog permissions for tables and charts in a given database.

    This function updates the `catalog`, `catalog_perm`, and `schema_perm` fields for
    tables and charts associated with the specified database. If `downgrade` is True,
    the `catalog` and `catalog_perm` fields are set to None, otherwise they are set
    to the provided `catalog` and `catalog_perm` values.

    Args:
        session (Session): The SQLAlchemy session to use for database operations.
        database (Database): The database object whose tables and charts will be updated.
        catalog_perm (str): The new catalog permission to set.
        catalog (str): The new catalog to set.
        downgrade (bool, optional): If True, reset the `catalog` and `catalog_perm` fields to None.
                                    Defaults to False.
    """
    # Mapping of table id to schema permission
    mapping = {}

    for table in (
        session.query(SqlaTable)
        .filter_by(database_id=database.id)
        .filter_by(catalog=catalog if downgrade else None)
    ):
        schema_perm = security_manager.get_schema_perm(
            database.database_name,
            None if downgrade else catalog,
            table.schema,
        )
        table.catalog = None if downgrade else catalog
        table.catalog_perm = catalog_perm
        table.schema_perm = schema_perm
        mapping[table.id] = schema_perm

    # Select all slices of type table that belong to the database
    for chart in (
        session.query(Slice)
        .join(SqlaTable, Slice.datasource_id == SqlaTable.id)
        .join(Database, SqlaTable.database_id == Database.id)
        .filter(Database.id == database.id)
        .filter(Slice.datasource_type == "table")
    ):
        # We only care about tables that exist in the mapping
        if mapping.get(chart.datasource_id) is not None:
            chart.catalog_perm = catalog_perm
            chart.schema_perm = mapping[chart.datasource_id]


def delete_models_non_default_catalog(
    session: Session, database: Database, catalog: str
) -> None:
    """
    Delete models that are not in the default catalog.

    This function iterates over a list of models defined by MODELS and deletes
    the rows where the `catalog` column does not match the specified catalog.

    Parameters:
        session (Session): The SQLAlchemy session to use for database operations.
        database (Database): The database instance containing the models to delete.
        catalog (Catalog): The catalog to use to filter the models to delete.
    """
    start_time = datetime.now()

    logger.info(f"Deleting models not in the default catalog: {catalog}")

    for model, column in MODELS:
        # Get the total number of rows that match the condition
        total_rows = (
            session.query(sa.func.count(model.id))
            .filter(getattr(model, column) == database.id)
            .filter(model.catalog != catalog)
            .scalar()
        )

        logger.info(
            f"Total rows to be processed for {model.__tablename__}: {total_rows:,}"
        )

        batch_size = get_batch_size(session)
        limit_value = min(batch_size, total_rows)

        # Update in batches using row numbers
        for i in range(0, total_rows, batch_size):
            subquery = (
                session.query(model.id)
                .filter(getattr(model, column) == database.id)
                .filter(model.catalog != catalog)
                .order_by(model.id)
                .offset(i)
                .limit(limit_value)
                .subquery()
            )

            # SQLite does not support multiple-table criteria within DELETE
            if session.bind.dialect.name == "sqlite":
                ids_to_delete = [row.id for row in session.query(subquery.c.id).all()]
                if ids_to_delete:
                    session.execute(
                        sa.delete(model)
                        .where(model.id.in_(ids_to_delete))
                        .execution_options(synchronize_session=False)
                    )
            else:
                session.execute(
                    sa.delete(model)
                    .where(model.id == subquery.c.id)
                    .execution_options(synchronize_session=False)
                )

            print_processed_batch(start_time, i, total_rows, model, batch_size)


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
    catalog_perm: str | None = security_manager.get_catalog_perm(
        database.database_name,
        default_catalog,
    )
    pvms: dict[str, tuple[str, ...]] = (
        {catalog_perm: ("catalog_access",)} if catalog_perm else {}
    )

    # rename existing schema permissions to include the catalog, and also find any new
    # schemas
    new_schema_pvms = upgrade_schema_perms(database, default_catalog, session)
    pvms.update(new_schema_pvms)

    # update existing models that have a `catalog` column so it points to the default
    # catalog
    update_catalog_column(session, database, default_catalog, False)

    # update `schema_perm` and `catalog_perm` for tables and charts
    update_schema_catalog_perms(session, database, catalog_perm, default_catalog, False)

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

    pvms: dict[str, tuple[str]] = {}
    for catalog in catalogs:
        perm: str | None = security_manager.get_catalog_perm(
            database.database_name, catalog
        )
        if perm:
            pvms[perm] = ("catalog_access",)
            new_schema_pvms = create_schema_perms(database, catalog)
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
        current_perm: str | None = security_manager.get_schema_perm(
            database.database_name,
            None,
            schema,
        )
        new_perm: str | None = security_manager.get_schema_perm(
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
        elif new_perm:
            # new schema discovered, need to create a new permission
            perms[new_perm] = ("schema_access",)

    return perms


def create_schema_perms(
    database: Database,
    catalog: str,
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
        perm: ("schema_access",)
        for schema in schemas
        if (
            perm := security_manager.get_schema_perm(
                database.database_name, catalog, schema
            )
        )
        is not None
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

    update_catalog_column(session, database, default_catalog, True)

    # update `schema_perm` and `catalog_perm` for tables and charts
    update_schema_catalog_perms(session, database, None, default_catalog, True)

    # delete models referencing non-default catalogs
    delete_models_non_default_catalog(session, database, default_catalog)

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
