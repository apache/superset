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
    """Get SQLAlchemy filters for DAR-allowed tables."""
    # pylint: disable=import-outside-toplevel
    import logging

    from superset import is_feature_enabled
    from superset.connectors.sqla.models import Database

    if not is_feature_enabled("DATA_ACCESS_RULES"):
        return []

    try:
        from superset.data_access_rules.utils import get_all_allowed_tables

        allowed_tables = get_all_allowed_tables()
        if not allowed_tables:
            return []

        # Build OR filters for each allowed table
        table_filters = []
        for table in allowed_tables:
            table_filter = and_(
                Database.database_name == table.database,
                base_model.table_name == table.table,
            )
            # Add schema filter if specified
            if table.schema:
                table_filter = and_(
                    table_filter,
                    base_model.schema == table.schema,
                )
            table_filters.append(table_filter)

        return table_filters
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
