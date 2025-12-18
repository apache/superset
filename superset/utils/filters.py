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
from typing import Any

from flask_appbuilder import Model
from sqlalchemy import and_, or_
from sqlalchemy.sql.elements import BooleanClauseList


def get_dar_dataset_filters(base_model: type[Model]) -> list[Any]:
    """
    Get SQLAlchemy filters for DAR-allowed datasets.

    Handles hierarchical permissions:
    - Database-level: allows all tables in the database
    - Catalog-level: allows all tables in the catalog
    - Schema-level: allows all tables in the schema
    - Table-level: allows only the specific table
    """
    # pylint: disable=import-outside-toplevel
    import logging

    from superset import is_feature_enabled
    from superset.connectors.sqla.models import Database

    if not is_feature_enabled("DATA_ACCESS_RULES"):
        return []

    try:
        from superset.data_access_rules.utils import get_all_allowed_entries

        allowed_entries = get_all_allowed_entries()
        if not allowed_entries:
            return []

        # Build OR filters for each allowed entry at its hierarchy level
        filters = []
        for entry in allowed_entries:
            # Start with database filter (always required)
            entry_filter = Database.database_name == entry.database

            # Add catalog filter if specified
            if entry.catalog is not None:
                entry_filter = and_(
                    entry_filter,
                    base_model.catalog == entry.catalog,
                )

            # Add schema filter if specified
            if entry.schema is not None:
                entry_filter = and_(
                    entry_filter,
                    base_model.schema == entry.schema,
                )

            # Add table filter if specified
            if entry.table is not None:
                entry_filter = and_(
                    entry_filter,
                    base_model.table_name == entry.table,
                )

            filters.append(entry_filter)

        return filters
    except Exception as ex:
        logging.getLogger(__name__).warning(
            "Error getting DAR dataset filters: %s", ex
        )
        return []


def get_dataset_access_filters(
    base_model: type[Model],
    *args: Any,
) -> BooleanClauseList:
    # pylint: disable=import-outside-toplevel
    from superset import security_manager
    from superset.connectors.sqla.models import Database

    database_ids = security_manager.get_accessible_databases()
    perms = security_manager.user_view_menu_names("datasource_access")
    schema_perms = security_manager.user_view_menu_names("schema_access")
    catalog_perms = security_manager.user_view_menu_names("catalog_access")

    # Get DAR-based table filters
    dar_filters = get_dar_dataset_filters(base_model)

    return or_(
        Database.id.in_(database_ids),
        base_model.perm.in_(perms),
        base_model.catalog_perm.in_(catalog_perms),
        base_model.schema_perm.in_(schema_perms),
        *dar_filters,
        *args,
    )
