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
from typing import Any, Type

from flask_appbuilder import Model
from sqlalchemy import or_
from sqlalchemy.sql.elements import BooleanClauseList


def get_dataset_access_filters(
    base_model: Type[Model],
    *args: Any,
) -> BooleanClauseList:
    # pylint: disable=import-outside-toplevel
    from superset import security_manager
    from superset.connectors.sqla.models import Database

    database_ids = security_manager.get_accessible_databases()
    perms = security_manager.user_view_menu_names("datasource_access")
    schema_perms = security_manager.user_view_menu_names("schema_access")

    return or_(
        Database.id.in_(database_ids),
        base_model.perm.in_(perms),
        base_model.schema_perm.in_(schema_perms),
        *args,
    )
