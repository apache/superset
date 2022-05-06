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
import uuid
from typing import Any, Optional, Union

from flask import g
from flask_appbuilder.security.sqla.models import Role
from flask_babel import lazy_gettext as _
from sqlalchemy import and_, or_
from sqlalchemy.orm.query import Query

from superset import db, is_feature_enabled, security_manager
from superset.models.core import FavStar
from superset.models.dashboard import Dashboard
from superset.models.embedded_dashboard import EmbeddedDashboard
from superset.models.slice import Slice
from superset.security.guest_token import GuestTokenResourceType, GuestUser
from superset.views.base import BaseFilter, is_user_admin
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


class DashboardCreatedByMeFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("Created by me")
    arg_name = "created_by_me"

    def apply(self, query: Query, value: Any) -> Query:
        return query.filter(
            or_(
                Dashboard.created_by_fk  # pylint: disable=comparison-with-callable
                == g.user.get_user_id(),
                Dashboard.changed_by_fk  # pylint: disable=comparison-with-callable
                == g.user.get_user_id(),
            )
        )


class DashboardFavoriteFilter(  # pylint: disable=too-few-public-methods
    BaseFavoriteFilter
):
    """
    Custom filter for the GET list that filters all dashboards that a user has favored
    """

    arg_name = "dashboard_is_favorite"
    class_name = "Dashboard"
    model = Dashboard


def is_uuid(value: Union[str, int]) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except ValueError:
        return False


class DashboardAccessFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    List dashboards with the following criteria:
        1. Those which the user owns
        2. Those which the user has favorited
        3. Those which have been published (if they have access to at least one slice)

    If the user is an admin then show all dashboards.
    This means they do not get curation but can still sort by "published"
    if they wish to see those dashboards which are published first.
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

        feature_flagged_filters = []
        if is_feature_enabled("DASHBOARD_RBAC"):
            roles_based_query = (
                db.session.query(Dashboard.id)
                .join(Dashboard.roles)
                .filter(
                    and_(
                        Dashboard.published.is_(True),
                        dashboard_has_roles,
                        Role.id.in_([x.id for x in security_manager.get_user_roles()]),
                    ),
                )
            )

            feature_flagged_filters.append(Dashboard.id.in_(roles_based_query))

        if is_feature_enabled("EMBEDDED_SUPERSET") and security_manager.is_guest_user(
            g.user
        ):

            guest_user: GuestUser = g.user
            embedded_dashboard_ids = [
                r["id"]
                for r in guest_user.resources
                if r["type"] == GuestTokenResourceType.DASHBOARD.value
            ]

            # TODO (embedded): only use uuid filter once uuids are rolled out
            condition = (
                Dashboard.embedded.any(
                    EmbeddedDashboard.uuid.in_(embedded_dashboard_ids)
                )
                if any(is_uuid(id_) for id_ in embedded_dashboard_ids)
                else Dashboard.id.in_(embedded_dashboard_ids)
            )

            feature_flagged_filters.append(condition)

        query = query.filter(
            or_(
                Dashboard.id.in_(owner_ids_query),
                Dashboard.id.in_(datasource_perm_query),
                Dashboard.id.in_(users_favorite_dash_query),
                *feature_flagged_filters,
            )
        )

        return query


class FilterRelatedRoles(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    A filter to allow searching for related roles of a resource.

    Use in the api by adding something like:
    related_field_filters = {
      "roles": RelatedFieldFilter("name", FilterRelatedRoles),
    }
    """

    name = _("Role")
    arg_name = "roles"

    def apply(self, query: Query, value: Optional[Any]) -> Query:
        role_model = security_manager.role_model
        if value:
            return query.filter(
                role_model.name.ilike(f"%{value}%"),
            )
        return query


class DashboardCertifiedFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all certified dashboards
    """

    name = _("Is certified")
    arg_name = "dashboard_is_certified"

    def apply(self, query: Query, value: Any) -> Query:
        if value is True:
            return query.filter(
                and_(
                    Dashboard.certified_by.isnot(None),
                    Dashboard.certified_by != "",
                )
            )
        if value is False:
            return query.filter(
                or_(
                    Dashboard.certified_by.is_(None),
                    Dashboard.certified_by == "",
                )
            )
        return query
