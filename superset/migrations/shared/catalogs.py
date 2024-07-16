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
from superset.daos.database import DatabaseDAO
from superset.migrations.shared.security_converge import add_pvms, ViewMenu
from superset.models.core import Database

logger = logging.getLogger(__name__)


Base: Type[Any] = declarative_base()


class SqlaTable(Base):
    __tablename__ = "tables"

    id = sa.Column(sa.Integer, primary_key=True)
    database_id = sa.Column(sa.Integer, nullable=False)
    schema_perm = sa.Column(sa.String(1000))
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
    schema_perm = sa.Column(sa.String(1000))


def get_schemas(database_name: str) -> list[str]:
    """
    Read all known schemas from the schema permissions.
    """
    query = f"""
SELECT
    avm.name
FROM ab_view_menu avm
JOIN ab_permission_view apv ON avm.id = apv.view_menu_id
JOIN ab_permission ap ON apv.permission_id = ap.id
WHERE
    avm.name LIKE '[{database_name}]%' AND
    ap.name = 'schema_access';
    """
    # [PostgreSQL].[postgres].[public] => public
    conn = op.get_bind()
    return sorted({row[0].split(".")[-1][1:-1] for row in conn.execute(query)})


def upgrade_catalog_perms(engines: set[str] | None = None) -> None:
    """
    Update models when catalogs are introduced in a DB engine spec.

    When an existing DB engine spec starts to support catalogs we need to:

        - Add a `catalog_access` permission for each catalog.
        - Populate the `catalog` field with the default catalog for each related model.
        - Update `schema_perm` to include the default catalog.

    """
    bind = op.get_bind()
    session = db.Session(bind=bind)
    for database in session.query(Database).all():
        db_engine_spec = database.db_engine_spec
        if (
            engines and db_engine_spec.engine not in engines
        ) or not db_engine_spec.supports_catalog:
            continue

        catalog = database.get_default_catalog()
        if catalog is None:
            continue

        perm = security_manager.get_catalog_perm(
            database.database_name,
            catalog,
        )
        add_pvms(session, {perm: ("catalog_access",)})

        upgrade_schema_perms(database, catalog, session)

        # update existing models
        models = [
            (Query, "database_id"),
            (SavedQuery, "db_id"),
            (TabState, "database_id"),
            (TableSchema, "database_id"),
            (SqlaTable, "database_id"),
        ]
        for model, column in models:
            for instance in session.query(model).filter(
                getattr(model, column) == database.id
            ):
                instance.catalog = catalog

        for table in session.query(SqlaTable).filter_by(database_id=database.id):
            schema_perm = security_manager.get_schema_perm(
                database.database_name,
                catalog,
                table.schema,
            )
            table.schema_perm = schema_perm
            for chart in session.query(Slice).filter_by(
                datasource_id=table.id,
                datasource_type="table",
            ):
                chart.schema_perm = schema_perm

    session.commit()


def upgrade_schema_perms(database: Database, catalog: str, session: Session) -> None:
    """
    Rename existing schema permissions to include the catalog.
    """
    ssh_tunnel = DatabaseDAO.get_ssh_tunnel(database.id)
    try:
        schemas = database.get_all_schema_names(
            catalog=catalog,
            cache=False,
            ssh_tunnel=ssh_tunnel,
        )
    except Exception:  # pylint: disable=broad-except
        schemas = get_schemas(database.database_name)

    for schema in schemas:
        perm = security_manager.get_schema_perm(
            database.database_name,
            None,
            schema,
        )
        existing_pvm = session.query(ViewMenu).filter_by(name=perm).one_or_none()
        if existing_pvm:
            existing_pvm.name = security_manager.get_schema_perm(
                database.database_name,
                catalog,
                schema,
            )


def downgrade_catalog_perms(engines: set[str] | None = None) -> None:
    """
    Reverse the process of `upgrade_catalog_perms`.
    """
    bind = op.get_bind()
    session = db.Session(bind=bind)
    for database in session.query(Database).all():
        db_engine_spec = database.db_engine_spec
        if (
            engines and db_engine_spec.engine not in engines
        ) or not db_engine_spec.supports_catalog:
            continue

        catalog = database.get_default_catalog()
        if catalog is None:
            continue

        downgrade_schema_perms(database, catalog, session)

        # update existing models
        models = [
            (Query, "database_id"),
            (SavedQuery, "db_id"),
            (TabState, "database_id"),
            (TableSchema, "database_id"),
            (SqlaTable, "database_id"),
        ]
        for model, column in models:
            for instance in session.query(model).filter(
                getattr(model, column) == database.id
            ):
                instance.catalog = None

        for table in session.query(SqlaTable).filter_by(database_id=database.id):
            schema_perm = security_manager.get_schema_perm(
                database.database_name,
                None,
                table.schema,
            )
            table.schema_perm = schema_perm
            for chart in session.query(Slice).filter_by(
                datasource_id=table.id,
                datasource_type="table",
            ):
                chart.schema_perm = schema_perm

    session.commit()


def downgrade_schema_perms(database: Database, catalog: str, session: Session) -> None:
    """
    Rename existing schema permissions to omit the catalog.
    """
    ssh_tunnel = DatabaseDAO.get_ssh_tunnel(database.id)
    try:
        schemas = database.get_all_schema_names(
            catalog=catalog,
            cache=False,
            ssh_tunnel=ssh_tunnel,
        )
    except Exception:  # pylint: disable=broad-except
        schemas = get_schemas(database.database_name)

    for schema in schemas:
        perm = security_manager.get_schema_perm(
            database.database_name,
            catalog,
            schema,
        )
        existing_pvm = session.query(ViewMenu).filter_by(name=perm).one_or_none()
        if existing_pvm:
            new_perm = security_manager.get_schema_perm(
                database.database_name,
                None,
                schema,
            )
            if pvm := session.query(ViewMenu).filter_by(name=new_perm).one_or_none():
                session.delete(pvm)
                session.flush()
            existing_pvm.name = new_perm
