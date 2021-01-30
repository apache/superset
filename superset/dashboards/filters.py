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

from flask_appbuilder.security.sqla.models import Role
from flask_babel import lazy_gettext as _
from sqlalchemy import and_, or_
from sqlalchemy.orm.query import Query

from superset import db, is_feature_enabled, security_manager
from superset.models.core import FavStar
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.views.base import BaseFilter, get_user_roles, is_user_admin
from superset.views.base_api import BaseFavoriteFilter


class DashboardTitleOrSlugFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("Title or Slug")
    arg_name = "title_or_slug"

    def apply(self, query: Query, value: Any) -> Query:
        if not value:
            return query
        ilike_value = f"%{value}%"
        return query.filter(
            or_(
                Dashboard.dashboard_title.ilike(ilike_value),
                Dashboard.slug.ilike(ilike_value),
            )
        )


class DashboardFavoriteFilter(
    BaseFavoriteFilter
):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all dashboards that a user has favored
    """

    arg_name = "dashboard_is_favorite"
    class_name = "Dashboard"
    model = Dashboard


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
        if is_user_admin():
            return query

        datasource_perms = security_manager.user_view_menu_names("datasource_access")
        schema_perms = security_manager.user_view_menu_names("schema_access")

        is_rbac_disabled_filter = []
        dashboard_has_roles = Dashboard.roles.any()
        if is_feature_enabled("DASHBOARD_RBAC"):
            is_rbac_disabled_filter.append(~dashboard_has_roles)

        datasource_perm_query = (
            db.session.query(Dashboard.id)
            .join(Dashboard.slices)
            .filter(
                and_(
                    Dashboard.published.is_(True),
                    *is_rbac_disabled_filter,
                    or_(
                        Slice.perm.in_(datasource_perms),
                        Slice.schema_perm.in_(schema_perms),
                        security_manager.can_access_all_datasources(),
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

        dashboard_rbac_or_filters = []
        if is_feature_enabled("DASHBOARD_RBAC"):
            roles_based_query = (
                db.session.query(Dashboard.id)
                .join(Dashboard.roles)
                .filter(
                    and_(
                        Dashboard.published.is_(True),
                        dashboard_has_roles,
                        Role.id.in_([x.id for x in get_user_roles()]),
                    ),
                )
            )

            dashboard_rbac_or_filters.append(Dashboard.id.in_(roles_based_query))

        query = query.filter(
            or_(
                Dashboard.id.in_(owner_ids_query),
                Dashboard.id.in_(datasource_perm_query),
                Dashboard.id.in_(users_favorite_dash_query),
                *dashboard_rbac_or_filters,
            )
        )

        return query
