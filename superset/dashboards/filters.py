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

from flask import current_app
from flask_babel import lazy_gettext as _
from sqlalchemy import and_, or_
from sqlalchemy.orm.query import Query

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.subjects.filters import (
    EditableFilter,
)
from superset.subjects.models import dashboard_editors, dashboard_viewers
from superset.tags.filters import BaseTagIdFilter, BaseTagNameFilter
from superset.utils.core import get_user_id
from superset.utils.filters import (
    get_dataset_access_filters,
    guest_embedded_dashboard_filter,
)
from superset.views.base import BaseFilter
from superset.views.base_api import BaseFavoriteFilter
from superset.views.filters import BaseDeletedRecencyFilter, BaseDeletedStateFilter


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
    arg_name = "dashboard_created_by_me"

    def apply(self, query: Query, value: Any) -> Query:
        return query.filter(
            or_(
                Dashboard.created_by_fk  # pylint: disable=comparison-with-callable
                == get_user_id(),
                Dashboard.changed_by_fk  # pylint: disable=comparison-with-callable
                == get_user_id(),
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


class DashboardTagNameFilter(BaseTagNameFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all dashboards associated with
    a certain tag (by its name).
    """

    arg_name = "dashboard_tags"
    class_name = "Dashboard"
    model = Dashboard


class DashboardTagIdFilter(BaseTagIdFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all dashboards associated with
    a certain tag (by its ID).
    """

    arg_name = "dashboard_tag_id"
    class_name = "Dashboard"
    model = Dashboard


class DashboardAccessFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    List dashboards with the following criteria:

        1. Embedded guests: only the dashboards in their token, nothing else
        2. Admins: all dashboards
        3. Editors: their dashboards (published or not)
        4. Viewers: published dashboards
        5. Dashboards with no viewers → fall back to dataset-based access
           (published only)
    """

    def apply(self, query: Query, value: Any) -> Query:
        # Guests are scoped to their token's dashboards only, never widened by
        # the role paths below (mirrors ChartFilter).
        if (guest_condition := guest_embedded_dashboard_filter()) is not None:
            return query.filter(guest_condition)

        if security_manager.is_admin():
            return query

        return self._apply_viewers(query)

    def _apply_viewers(self, query: Query) -> Query:
        from superset.subjects.utils import get_user_subject_ids_subquery

        user_id = get_user_id()
        subject_subquery = get_user_subject_ids_subquery(user_id) if user_id else None

        filters: list[Any] = []

        # (A) Editor query: editors see all their dashboards (published or not)
        if subject_subquery is not None:
            editor_query = (
                db.session.query(Dashboard.id)
                .join(
                    dashboard_editors,
                    Dashboard.id == dashboard_editors.c.dashboard_id,
                )
                .filter(dashboard_editors.c.subject_id.in_(subject_subquery))
            )
            filters.append(Dashboard.id.in_(editor_query))

        # (B) Viewer query: viewers see published dashboards
        if subject_subquery is not None:
            viewer_query = (
                db.session.query(Dashboard.id)
                .join(
                    dashboard_viewers,
                    Dashboard.id == dashboard_viewers.c.dashboard_id,
                )
                .filter(
                    and_(
                        Dashboard.published.is_(True),
                        dashboard_viewers.c.subject_id.in_(subject_subquery),
                    )
                )
            )
            filters.append(Dashboard.id.in_(viewer_query))

        # (C) No-viewer fallback: dashboards with no viewers → dataset-based access
        dashboard_has_viewers = Dashboard.viewers.any()
        no_viewer_query = (
            db.session.query(Dashboard.id)
            .join(Dashboard.slices, isouter=True)
            .join(SqlaTable, Slice.datasource_id == SqlaTable.id)
            .join(Database, SqlaTable.database_id == Database.id)
            .filter(
                and_(
                    Dashboard.published.is_(True),
                    ~dashboard_has_viewers,
                    get_dataset_access_filters(
                        Slice,
                        security_manager.can_access_all_datasources(),
                    ),
                )
            )
        )
        filters.append(Dashboard.id.in_(no_viewer_query))

        extra_filters = current_app.config.get("EXTRA_ACCESS_QUERY_FILTERS", {})
        if extra_dashboards_filter := extra_filters.get("dashboards"):
            user_id = get_user_id()
            if user_id:
                filters.append(Dashboard.id.in_(extra_dashboards_filter(user_id)))

        return query.filter(or_(*filters)) if filters else query


class DashboardEditableFilter(EditableFilter):  # pylint: disable=too-few-public-methods
    """Filter for dashboards the user can edit."""

    model = Dashboard
    editors_table = dashboard_editors
    editors_fk_column = "dashboard_id"


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


class DashboardHasCreatedByFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all dashboards created by user
    """

    name = _("Has created by")
    arg_name = "dashboard_has_created_by"

    def apply(self, query: Query, value: Any) -> Query:
        if value is True:
            return query.filter(and_(Dashboard.created_by_fk.isnot(None)))
        if value is False:
            return query.filter(and_(Dashboard.created_by_fk.is_(None)))
        return query


class DashboardDeletedRecencyFilter(  # pylint: disable=too-few-public-methods
    BaseDeletedRecencyFilter
):
    """Archive time-range preset: rows archived within the last N days."""

    arg_name = "dashboard_deleted_recency"


class DashboardDeletedStateFilter(  # pylint: disable=too-few-public-methods
    BaseDeletedStateFilter
):
    """Rison filter for the GET list that exposes soft-deleted dashboards.

    Soft-deleted rows are scoped to the **restore audience** (editors or
    admins) by ``BaseDeletedStateFilter._scope_to_restore_audience`` — the
    cross-entity contract lives on the base, so this class is a pure
    declaration. Live rows keep their normal ``DashboardAccessFilter``
    visibility.
    """

    arg_name = "dashboard_deleted_state"
    model = Dashboard
