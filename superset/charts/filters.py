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

from flask_babel import lazy_gettext as _
from sqlalchemy import and_, or_
from sqlalchemy.orm import aliased
from sqlalchemy.orm.query import Query

from superset import db, is_feature_enabled, security_manager
from superset.connectors.sqla import models
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import FavStar
from superset.models.slice import Slice
from superset.subjects.filters import EditableFilter
from superset.subjects.models import chart_editors
from superset.tags.filters import BaseTagIdFilter, BaseTagNameFilter
from superset.utils.core import get_user_id
from superset.utils.filters import get_dataset_access_filters
from superset.views.base import BaseFilter
from superset.views.base_api import BaseFavoriteFilter


class ChartAllTextFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("All Text")
    arg_name = "chart_all_text"

    def apply(self, query: Query, value: Any) -> Query:
        if not value:
            return query
        ilike_value = f"%{value}%"
        return query.filter(
            or_(
                Slice.slice_name.ilike(ilike_value),
                Slice.description.ilike(ilike_value),
                Slice.viz_type.ilike(ilike_value),
                SqlaTable.table_name.ilike(ilike_value),
            )
        )


class ChartFavoriteFilter(BaseFavoriteFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all charts that a user has favored
    """

    arg_name = "chart_is_favorite"
    class_name = "slice"
    model = Slice


class ChartTagNameFilter(BaseTagNameFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all charts associated with
    a certain tag (by its name).
    """

    arg_name = "chart_tags"
    class_name = "slice"
    model = Slice


class ChartTagIdFilter(BaseTagIdFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all charts associated with
    a certain tag (by its ID).
    """

    arg_name = "chart_tag_id"
    class_name = "slice"
    model = Slice


class ChartCertifiedFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all certified charts
    """

    name = _("Is certified")
    arg_name = "chart_is_certified"

    def apply(self, query: Query, value: Any) -> Query:
        if value is True:
            return query.filter(and_(Slice.certified_by.isnot(None)))
        if value is False:
            return query.filter(and_(Slice.certified_by.is_(None)))
        return query


class ChartFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    def apply(self, query: Query, value: Any) -> Query:
        if security_manager.can_access_all_datasources():
            return query

        if is_feature_enabled("ENABLE_VIEWERS"):
            return self._apply_viewers(query)
        return self._apply_legacy(query)

    def _apply_viewers(self, query: Query) -> Query:
        from superset.subjects.models import chart_editors, chart_viewers
        from superset.subjects.utils import get_user_subject_ids_subquery

        user_id = get_user_id()
        subject_subquery = get_user_subject_ids_subquery(user_id) if user_id else None

        filters: list[Any] = []

        # (A) Editor query: editors see all their charts
        if subject_subquery is not None:
            editor_query = (
                db.session.query(Slice.id)
                .join(chart_editors, Slice.id == chart_editors.c.chart_id)
                .filter(chart_editors.c.subject_id.in_(subject_subquery))
            )
            filters.append(Slice.id.in_(editor_query))

        # (B) Viewer query: viewers see their charts
        if subject_subquery is not None:
            viewer_query = (
                db.session.query(Slice.id)
                .join(chart_viewers, Slice.id == chart_viewers.c.chart_id)
                .filter(chart_viewers.c.subject_id.in_(subject_subquery))
            )
            filters.append(Slice.id.in_(viewer_query))

        # (C) No-viewer fallback: charts with no viewers → dataset-based access
        chart_has_viewers = Slice.viewers.any()
        table_alias = aliased(SqlaTable)
        no_viewer_query = (
            db.session.query(Slice.id)
            .join(table_alias, Slice.datasource_id == table_alias.id)
            .join(models.Database, table_alias.database_id == models.Database.id)
            .filter(
                and_(
                    ~chart_has_viewers,
                    get_dataset_access_filters(Slice),
                )
            )
        )
        filters.append(Slice.id.in_(no_viewer_query))

        return query.filter(or_(*filters)) if filters else query

    def _apply_legacy(self, query: Query) -> Query:
        table_alias = aliased(SqlaTable)
        query = query.join(table_alias, self.model.datasource_id == table_alias.id)
        query = query.join(
            models.Database, table_alias.database_id == models.Database.id
        )
        return query.filter(get_dataset_access_filters(self.model))


class ChartEditableFilter(EditableFilter):  # pylint: disable=too-few-public-methods
    """Filter for charts the user can edit."""

    model = Slice
    editors_table = chart_editors
    editors_fk_column = "chart_id"


class ChartHasCreatedByFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all charts created by user
    """

    name = _("Has created by")
    arg_name = "chart_has_created_by"

    def apply(self, query: Query, value: Any) -> Query:
        if value is True:
            return query.filter(and_(Slice.created_by_fk.isnot(None)))
        if value is False:
            return query.filter(and_(Slice.created_by_fk.is_(None)))
        return query


class ChartCreatedByMeFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("Created by me")
    arg_name = "chart_created_by_me"

    def apply(self, query: Query, value: Any) -> Query:
        return query.filter(
            or_(
                Slice.created_by_fk  # pylint: disable=comparison-with-callable
                == get_user_id(),
                Slice.changed_by_fk  # pylint: disable=comparison-with-callable
                == get_user_id(),
            )
        )


class ChartOwnedCreatedFavoredByMeFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET chart that filters all charts the user
    owns, created, changed or favored.
    """

    name = _("Owned Created or Favored")
    arg_name = "chart_owned_created_favored_by_me"

    def apply(self, query: Query, value: Any) -> Query:
        # If anonymous user filter nothing
        if security_manager.current_user is None:
            return query

        from superset.subjects.models import chart_editors, Subject

        editor_ids_query = (
            db.session.query(chart_editors.c.chart_id)
            .join(
                Subject.__table__,
                Subject.__table__.c.id == chart_editors.c.subject_id,
            )
            .filter(
                Subject.__table__.c.type == 1,
                Subject.__table__.c.user_id == get_user_id(),
            )
        )

        return query.join(
            FavStar,
            and_(
                FavStar.user_id == get_user_id(),
                FavStar.class_name == "slice",
                Slice.id == FavStar.obj_id,
            ),
            isouter=True,
        ).filter(
            # pylint: disable=comparison-with-callable
            or_(
                Slice.id.in_(editor_ids_query),
                Slice.created_by_fk == get_user_id(),
                Slice.changed_by_fk == get_user_id(),
                FavStar.user_id == get_user_id(),
            )
        )
