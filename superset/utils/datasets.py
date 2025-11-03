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
from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable, sqlatable_roles, sqlatable_user
from superset.utils.core import get_user_id, QueryObjectFilterClause


def get_datasets_authorized_for_user_roles() -> list[QueryObjectFilterClause]:
    """
    Function that returns the list of datasets authorized by the user's roles
    """
    return (
        db.session.query(sqlatable_roles.c.table_id)
        .join(
            SqlaTable,
            SqlaTable.id == sqlatable_roles.c.table_id,
        )
        .filter(
            sqlatable_roles.c.role_id.in_(
                [x.id for x in security_manager.get_user_roles()]
            ),
        )
    )


def get_datasets_authorized_for_owners() -> list[QueryObjectFilterClause]:
    """
    Function that returns the list of datasets where user is owner
    """
    return (
        db.session.query(sqlatable_user.c.table_id)
        .join(
            SqlaTable,
            SqlaTable.id == sqlatable_user.c.table_id,
        )
        .filter(sqlatable_user.c.user_id == get_user_id())
    )
