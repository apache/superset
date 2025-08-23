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

from superset import security_manager
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.db_engine_specs.base import GenericDBException
from superset.models.core import Database

logger = logging.getLogger(__name__)


def add_permissions(database: Database, ssh_tunnel: SSHTunnel | None) -> None:
    """
    Add DAR for catalogs and schemas.
    """
    if database.db_engine_spec.supports_catalog:
        catalogs = database.get_all_catalog_names(
            cache=False,
            ssh_tunnel=ssh_tunnel,
        )

        for catalog in catalogs:
            security_manager.add_permission_view_menu(
                "catalog_access",
                security_manager.get_catalog_perm(
                    database.database_name,
                    catalog,
                ),
            )
    else:
        catalogs = [None]

    for catalog in catalogs:
        try:
            for schema in database.get_all_schema_names(
                catalog=catalog,
                cache=False,
                ssh_tunnel=ssh_tunnel,
            ):
                security_manager.add_permission_view_menu(
                    "schema_access",
                    security_manager.get_schema_perm(
                        database.database_name,
                        catalog,
                        schema,
                    ),
                )
        except GenericDBException:  # pylint: disable=broad-except
            logger.warning("Error processing catalog '%s'", catalog)
            continue
