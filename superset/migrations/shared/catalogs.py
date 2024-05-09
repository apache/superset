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

from alembic import op

from superset import db, security_manager
from superset.daos.database import DatabaseDAO
from superset.models.core import Database

logger = logging.getLogger(__name__)


def upgrade_schema_perms(engine: str | None = None) -> None:
    """
    Update schema permissions to include the catalog part.

    Before SIP-95 schema permissions were stored in the format `[db].[schema]`. With the
    introduction of catalogs, any existing permissions need to be renamed to include the
    catalog: `[db].[catalog].[schema]`.
    """
    bind = op.get_bind()
    session = db.Session(bind=bind)
    for database in session.query(Database).all():
        db_engine_spec = database.db_engine_spec
        if (
            engine and db_engine_spec.engine != engine
        ) or not db_engine_spec.supports_catalog:
            continue

        catalog = database.get_default_catalog()
        ssh_tunnel = DatabaseDAO.get_ssh_tunnel(database.id)
        for schema in database.get_all_schema_names(
            catalog=catalog,
            cache=False,
            ssh_tunnel=ssh_tunnel,
        ):
            perm = security_manager.get_schema_perm(
                database.database_name,
                None,
                schema,
            )
            existing_pvm = security_manager.find_permission_view_menu(
                "schema_access",
                perm,
            )
            if existing_pvm:
                existing_pvm.view_menu.name = security_manager.get_schema_perm(
                    database.database_name,
                    catalog,
                    schema,
                )

    session.commit()


def downgrade_schema_perms(engine: str | None = None) -> None:
    """
    Update schema permissions to not have the catalog part.

    Before SIP-95 schema permissions were stored in the format `[db].[schema]`. With the
    introduction of catalogs, any existing permissions need to be renamed to include the
    catalog: `[db].[catalog].[schema]`.

    This helped function reverts the process.
    """
    bind = op.get_bind()
    session = db.Session(bind=bind)
    for database in session.query(Database).all():
        db_engine_spec = database.db_engine_spec
        if (
            engine and db_engine_spec.engine != engine
        ) or not db_engine_spec.supports_catalog:
            continue

        catalog = database.get_default_catalog()
        ssh_tunnel = DatabaseDAO.get_ssh_tunnel(database.id)
        for schema in database.get_all_schema_names(
            catalog=catalog,
            cache=False,
            ssh_tunnel=ssh_tunnel,
        ):
            perm = security_manager.get_schema_perm(
                database.database_name,
                catalog,
                schema,
            )
            existing_pvm = security_manager.find_permission_view_menu(
                "schema_access",
                perm,
            )
            if existing_pvm:
                existing_pvm.view_menu.name = security_manager.get_schema_perm(
                    database.database_name,
                    None,
                    schema,
                )

    session.commit()
