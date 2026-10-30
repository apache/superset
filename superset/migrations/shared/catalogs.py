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
Catalog permission helpers for the migrations that enabled catalogs per engine.

When a DB engine spec starts supporting catalogs, existing datasets, queries and
schema permissions of databases using that engine have no catalog. These helpers
backfill the default catalog for those databases, so that schema permissions keep
granting access once permissions become catalog-qualified.

The backfill never connects to an analytical database and never decrypts
credentials. The default catalog is derived only from the stored SQLAlchemy URI
(and, for Databricks, the plain-text ``extra`` field), and only for engines where
that is how the engine spec itself determines it. Databases where the default
catalog can't be derived this way are skipped and logged.

The helpers use local models frozen at this revision instead of the live
``Database`` model and DB engine specs, which change over time and may not match
the metadata schema the migrations run against.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime
from functools import partial
from typing import Any, Type, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.url import URL
from sqlalchemy.orm import declarative_base, Session
from sqlalchemy.sql.elements import ColumnElement

from superset import db
from superset.databases.utils import make_url_safe
from superset.migrations.shared.security_converge import (
    add_pvms,
    Permission,
    PermissionView,
    ViewMenu,
)
from superset.utils import json

logger = logging.getLogger("alembic.env")

Base: Type[Any] = declarative_base()


class Database(Base):
    __tablename__ = "dbs"

    id = sa.Column(sa.Integer, primary_key=True)
    database_name = sa.Column(sa.String(250))
    sqlalchemy_uri = sa.Column(sa.String(1024))
    extra = sa.Column(sa.Text)


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

# URI backends that resolve to a different engine name.
ENGINE_ALIASES = {"postgres": "postgresql"}


class CatalogRequiresConnectionError(Exception):
    """
    The default catalog of a database can only be determined by connecting to it.
    """


def _get_url_database_prefix(url: URL, extra: dict[str, Any]) -> str | None:
    """
    The first path component of the URI database, used by Presto, Trino,
    Snowflake and Databricks over PyHive (``trino://host/catalog/schema``).
    """
    return url.database.split("/")[0] if url.database else None


def _get_url_database(url: URL, extra: dict[str, Any]) -> str | None:
    """
    The URI database, used by Postgres (``postgresql://host/dbname``).
    """
    return url.database or None


def _get_bigquery_project(url: URL, extra: dict[str, Any]) -> str | None:
    """
    The BigQuery project, when explicit in the URI (``bigquery://project`` or
    ``bigquery:///project``). Otherwise it's inferred from the credentials, which
    requires a connection.
    """
    if project := url.host or url.database:
        return project
    raise CatalogRequiresConnectionError()


def _get_databricks_catalog(url: URL, extra: dict[str, Any]) -> str | None:
    """
    The Databricks catalog, which depends on the driver:

    - Native connector (``databricks+connector://``): ``connect_args.catalog`` in
      ``extra``. Without it the default catalog is found by querying the database.
    - Python connector (``databricks://``): the ``catalog`` URI query parameter.
      Without it the database has no default catalog.
    - PyHive (``databricks+pyhive://``): the first path component of the URI
      database.
    - Other drivers don't support catalogs.
    """
    driver = url.drivername.partition("+")[2]
    if driver == "connector":
        engine_params = extra.get("engine_params")
        connect_args = (
            engine_params.get("connect_args")
            if isinstance(engine_params, dict)
            else None
        )
        catalog = (
            connect_args.get("catalog") if isinstance(connect_args, dict) else None
        )
        if not (isinstance(catalog, str) and catalog):
            raise CatalogRequiresConnectionError()
        return catalog

    if driver in {"", "databricks", "databricks-sql-python"}:
        catalog = url.query.get("catalog")
        return catalog if isinstance(catalog, str) and catalog else None

    if driver == "pyhive":
        return _get_url_database_prefix(url, extra)

    return None


DEFAULT_CATALOG_GETTERS: dict[str, Callable[[URL, dict[str, Any]], str | None]] = {
    "postgresql": _get_url_database,
    "presto": _get_url_database_prefix,
    "trino": _get_url_database_prefix,
    "snowflake": _get_url_database_prefix,
    "bigquery": _get_bigquery_project,
    "databricks": _get_databricks_catalog,
}


def parse_database_uri(database: Database) -> tuple[str, URL] | None:
    """
    Return the engine name and parsed URL of a database, without loading its
    SQLAlchemy dialect. Returns ``None`` if the URI is invalid.
    """
    try:
        url = make_url_safe((database.sqlalchemy_uri or "").strip())
    except Exception:  # pylint: disable=broad-except
        return None

    backend = url.get_backend_name()
    return ENGINE_ALIASES.get(backend, backend), url


def get_default_catalog(database: Database, engine: str, url: URL) -> str | None:
    """
    Derive the default catalog of a database from its stored configuration.

    Returns ``None`` when the database has no default catalog, and raises
    ``CatalogRequiresConnectionError`` when it can only be found by connecting to the
    database.
    """
    try:
        extra = json.loads(database.extra) if database.extra else {}
    except (TypeError, ValueError):
        extra = {}
    if not isinstance(extra, dict):
        extra = {}

    return DEFAULT_CATALOG_GETTERS[engine](url, extra)


def get_databases_with_default_catalog(
    session: Session,
    engines: set[str] | None,
    action: str,
) -> list[tuple[Database, str]]:
    """
    Return the databases of the given engines, with their default catalog.

    Databases without a default catalog, or whose default catalog can't be derived
    without a connection, are skipped. ``action`` describes the operation in log
    messages.
    """
    databases = []
    for database in session.query(Database).all():
        if (result := parse_database_uri(database)) is None:
            # the URI may contain credentials, so it's not logged
            logger.warning(
                "Skipping catalog %s for database %s: invalid SQLAlchemy URI",
                action,
                database.database_name,
            )
            continue
        engine, url = result
        if engine not in DEFAULT_CATALOG_GETTERS or (engines and engine not in engines):
            continue

        try:
            default_catalog = get_default_catalog(database, engine, url)
        except CatalogRequiresConnectionError:
            logger.warning(
                "Skipping catalog %s for database %s: its default catalog can't be "
                "determined without connecting to it. See UPDATING.md for the "
                "manual steps.",
                action,
                database.database_name,
            )
            continue

        if default_catalog:
            databases.append((database, default_catalog))
        else:
            logger.info(
                "Skipping catalog %s for database %s: no default catalog",
                action,
                database.database_name,
            )

    return databases


def get_catalog_perm(database_name: str, catalog: str) -> str:
    return f"[{database_name}].[{catalog}]"


def get_schema_perm(
    database_name: str,
    catalog: str | None,
    schema: str | None,
) -> str | None:
    if schema is None:
        return None
    if catalog:
        return f"[{database_name}].[{catalog}].[{schema}]"
    return f"[{database_name}].[{schema}]"


def get_schema_pvms(database_name: str, session: Session) -> list[PermissionView]:
    """
    Return the existing schema permissions of a database.
    """
    prefix = f"[{database_name}]."
    return [
        pvm
        for pvm in session.query(PermissionView)
        .join(Permission, PermissionView.permission_id == Permission.id)
        .join(ViewMenu, PermissionView.view_menu_id == ViewMenu.id)
        .filter(
            Permission.name == "schema_access",
            ViewMenu.name.like(f"{prefix}%"),
        )
        .all()
        # the LIKE pattern can over-match, eg, when the name has underscores
        if pvm.view_menu.name.startswith(prefix)
    ]


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
    Log the progress of batch processing.
    """
    elapsed_seconds = (datetime.now() - start_time).total_seconds()
    elapsed_formatted = f"{int(elapsed_seconds // 3600):02}:{int((elapsed_seconds % 3600) // 60):02}:{int(elapsed_seconds % 60):02}"  # noqa: E501
    rows_processed = min(offset + batch_size, total_rows)
    logger.info(
        "%s - %s of %s %s rows processed (%s%%)",
        elapsed_formatted,
        f"{rows_processed:,}",
        f"{total_rows:,}",
        model.__tablename__,
        f"{(rows_processed / total_rows) * 100:.2f}",
    )


def update_catalog_column(
    session: Session,
    database: Database,
    get_value: Callable[[ModelType], ColumnElement[Any]],
) -> None:
    """
    Update the ``catalog`` column of the SQL Lab models of a database.

    The new value is an expression of the current one, so that the set of rows
    being processed doesn't change between batches. The update is done in batches
    to reduce memory usage and lock duration.
    """
    start_time = datetime.now()

    for model, column in MODELS:
        total_rows = (
            session.query(sa.func.count(model.id))
            .filter(getattr(model, column) == database.id)
            .scalar()
        )

        logger.info(
            "Total rows to be processed for %s: %s",
            model.__tablename__,
            f"{total_rows:,}",
        )

        batch_size = get_batch_size(session)
        limit_value = min(batch_size, total_rows)

        for i in range(0, total_rows, batch_size):
            subquery = (
                session.query(model.id)
                .filter(getattr(model, column) == database.id)
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
                        .values(catalog=get_value(model))
                        .execution_options(synchronize_session=False)
                    )
            else:
                session.execute(
                    sa.update(model)
                    .where(model.id == subquery.c.id)
                    .values(catalog=get_value(model))
                    .execution_options(synchronize_session=False)
                )

            print_processed_batch(start_time, i, total_rows, model, batch_size)


def fill_catalog(catalog: str, model: ModelType) -> ColumnElement[Any]:
    """
    Set the catalog of rows without one.
    """
    return sa.func.coalesce(model.catalog, catalog)


def clear_catalog(catalog: str, model: ModelType) -> ColumnElement[Any]:
    """
    Clear the catalog of rows in the given catalog.
    """
    return sa.func.nullif(model.catalog, catalog)


def update_schema_catalog_perms(
    session: Session,
    database: Database,
    current_catalog: str | None,
    new_catalog: str | None,
) -> None:
    """
    Move the datasets of a database in ``current_catalog`` to ``new_catalog``,
    updating the catalog and schema permissions of the datasets and their charts.
    """
    catalog_perm = (
        get_catalog_perm(database.database_name, new_catalog) if new_catalog else None
    )

    # mapping of table id to schema permission
    mapping = {}
    for table in session.query(SqlaTable).filter_by(
        database_id=database.id,
        catalog=current_catalog,
    ):
        schema_perm = get_schema_perm(database.database_name, new_catalog, table.schema)
        table.catalog = new_catalog
        table.catalog_perm = catalog_perm
        table.schema_perm = schema_perm
        mapping[table.id] = schema_perm

    if not mapping:
        return

    for chart in (
        session.query(Slice)
        .join(SqlaTable, Slice.datasource_id == SqlaTable.id)
        .filter(SqlaTable.database_id == database.id)
        .filter(Slice.datasource_type == "table")
    ):
        if chart.datasource_id in mapping:
            chart.catalog_perm = catalog_perm
            chart.schema_perm = mapping[chart.datasource_id]


def upgrade_schema_perms(
    database: Database,
    default_catalog: str,
    session: Session,
) -> None:
    """
    Rename existing schema permissions to include the default catalog.

    Schema permissions are stored as strings, in the form:

        [database_name].[schema_name]

    When catalogs are introduced for a DB engine spec they are renamed to:

        [database_name].[default_catalog_name].[schema_name]

    """
    for pvm in get_schema_pvms(database.database_name, session):
        parts = pvm.view_menu.name[1:-1].split("].[")
        if len(parts) != 2:
            continue

        new_name = get_schema_perm(database.database_name, default_catalog, parts[1])
        if not session.query(ViewMenu).filter_by(name=new_name).one_or_none():
            pvm.view_menu.name = new_name


def downgrade_schema_perms(
    database: Database,
    default_catalog: str,
    session: Session,
) -> None:
    """
    Rename schema permissions in the default catalog to omit it.
    """
    for pvm in get_schema_pvms(database.database_name, session):
        parts = pvm.view_menu.name[1:-1].split("].[")
        if len(parts) != 3 or parts[1] != default_catalog:
            continue

        new_name = get_schema_perm(database.database_name, None, parts[2])
        if not session.query(ViewMenu).filter_by(name=new_name).one_or_none():
            pvm.view_menu.name = new_name


def upgrade_catalog_perms(engines: set[str] | None = None) -> None:
    """
    Backfill the default catalog when catalogs are introduced in a DB engine spec.

    For each database of the given engines with a default catalog that can be
    derived from its stored configuration:

        - Add the `catalog_access` permission for the default catalog.
        - Rename existing `schema_access` permissions to include the default catalog.
        - Populate the `catalog` field of datasets and SQL Lab models.
        - Update `schema_perm` and `catalog_perm` of datasets and charts.

    Permissions for other catalogs are not created, since listing them requires a
    connection; syncing the database permissions creates them.
    """
    session = db.Session(bind=op.get_bind())

    for database, default_catalog in get_databases_with_default_catalog(
        session, engines, "backfill"
    ):
        logger.info(
            "Backfilling catalog %s for database %s",
            default_catalog,
            database.database_name,
        )
        upgrade_schema_perms(database, default_catalog, session)
        update_catalog_column(
            session,
            database,
            partial(fill_catalog, default_catalog),
        )
        update_schema_catalog_perms(session, database, None, default_catalog)
        add_pvms(
            session,
            {
                get_catalog_perm(database.database_name, default_catalog): (
                    "catalog_access",
                )
            },
        )

    session.flush()


def downgrade_catalog_perms(engines: set[str] | None = None) -> None:
    """
    Reverse `upgrade_catalog_perms` for the default catalog.

    For each database of the given engines with a derivable default catalog:

        - Delete the `catalog_access` permission for the default catalog.
        - Rename `schema_access` permissions in the default catalog to omit it.
        - Clear the `catalog` field of models in the default catalog.
        - Update `schema_perm` and `catalog_perm` of datasets and charts in the
          default catalog.

    Models and permissions in other catalogs are left untouched. Databases whose
    default catalog can only be found by connecting to them (BigQuery without a
    project in the URI, Databricks native connector without ``connect_args.catalog``)
    are skipped, even if their catalogs were filled in by an upgrade that connected
    to them.
    """
    session = db.Session(bind=op.get_bind())

    for database, default_catalog in get_databases_with_default_catalog(
        session, engines, "rollback"
    ):
        logger.info(
            "Removing catalog %s from database %s",
            default_catalog,
            database.database_name,
        )
        catalog_perm = get_catalog_perm(database.database_name, default_catalog)
        for pvm in (
            session.query(PermissionView)
            .join(Permission, PermissionView.permission_id == Permission.id)
            .join(ViewMenu, PermissionView.view_menu_id == ViewMenu.id)
            .filter(
                Permission.name == "catalog_access",
                ViewMenu.name == catalog_perm,
            )
            .all()
        ):
            session.delete(pvm)
            session.delete(pvm.view_menu)

        downgrade_schema_perms(database, default_catalog, session)
        update_catalog_column(
            session,
            database,
            partial(clear_catalog, default_catalog),
        )
        update_schema_catalog_perms(session, database, default_catalog, None)

    session.flush()
