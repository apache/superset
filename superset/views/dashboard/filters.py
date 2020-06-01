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

from sqlalchemy import and_, or_
from sqlalchemy.orm.query import Query

from superset import db, security_manager
from superset.models.core import FavStar
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.views.base import BaseFilter

from ..base import get_user_roles


class DashboardFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    List dashboards with the following criteria:
        1. Those which the user owns
        2. Those which the user has favorited
        3. Those which have been published (if they have access to at least one slice)

    If the user is an admin show them all dashboards.
    This means they do not get curation but can still sort by "published"
    if they wish to see those dashboards which are published first
    """

    def apply(self, query: Query, value: Any) -> Query:
        user_roles = [role.name.lower() for role in list(get_user_roles())]
        if "admin" in user_roles:
            return query

        datasource_perms = security_manager.user_view_menu_names("datasource_access")
        schema_perms = security_manager.user_view_menu_names("schema_access")
        all_datasource_access = security_manager.all_datasource_access()
        published_dash_query = (
            db.session.query(Dashboard.id)
            .join(Dashboard.slices)
            .filter(
                and_(
                    Dashboard.published == True,  # pylint: disable=singleton-comparison
                    or_(
                        Slice.perm.in_(datasource_perms),
                        Slice.schema_perm.in_(schema_perms),
                        all_datasource_access,
                    ),
                )
            )
        )

        users_favorite_dash_query = db.session.query(FavStar.obj_id).filter(
            and_(
                FavStar.user_id == security_manager.user_model.get_user_id(),
                FavStar.class_name == "Dashboard",
            )
        )
        owner_ids_query = (
            db.session.query(Dashboard.id)
            .join(Dashboard.owners)
            .filter(
                security_manager.user_model.id
                == security_manager.user_model.get_user_id()
            )
        )

        query = query.filter(
            or_(
                Dashboard.id.in_(owner_ids_query),
                Dashboard.id.in_(published_dash_query),
                Dashboard.id.in_(users_favorite_dash_query),
            )
        )

        return query
