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
import logging
from typing import Any, cast, Optional

from flask import current_app as app
from flask_appbuilder.models.filters import BaseFilter
from flask_babel import lazy_gettext
from sqlalchemy import and_, or_
from sqlalchemy.orm import Query

from superset import security_manager

logger = logging.getLogger(__name__)


class FilterRelatedOwners(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    A filter to allow searching for related owners of a resource.

    Use in the api by adding something like:
    related_field_filters = {
      "owners": RelatedFieldFilter("first_name", FilterRelatedOwners),
    }
    """

    name = lazy_gettext("Owner")
    arg_name = "owners"

    def apply(self, query: Query, value: Optional[Any]) -> Query:
        user_model = security_manager.user_model
        like_value = "%" + cast(str, value) + "%"
        return query.filter(
            or_(
                # could be made to handle spaces between names more gracefully
                (user_model.first_name + " " + user_model.last_name).ilike(like_value),
                user_model.username.ilike(like_value),
            )
        )


class BaseFilterRelatedUsers(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Filter to apply on related users. Will exclude users in EXCLUDE_USERS_FROM_LISTS

    Use in the api by adding something like:
    ```
    base_related_field_filters = {
        "owners": [["id", BaseFilterRelatedUsers, lambda: []]],
        "created_by": [["id", BaseFilterRelatedUsers, lambda: []]],
    }
    ```
    """

    name = lazy_gettext("username")
    arg_name = "username"

    def apply(self, query: Query, value: Optional[Any]) -> Query:
        if extra_filters := app.config["EXTRA_RELATED_QUERY_FILTERS"].get(
            "user",
        ):
            query = extra_filters(query)

        exclude_users = (
            security_manager.get_exclude_users_from_lists()
            if app.config["EXCLUDE_USERS_FROM_LISTS"] is None
            else app.config["EXCLUDE_USERS_FROM_LISTS"]
        )
        if exclude_users:
            user_model = security_manager.user_model
            return query.filter(and_(user_model.username.not_in(exclude_users)))

        return query


class BaseFilterRelatedRoles(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Filter to apply on related roles.
    """

    name = lazy_gettext("role")
    arg_name = "role"

    def apply(self, query: Query, value: Optional[Any]) -> Query:
        if extra_filters := app.config["EXTRA_RELATED_QUERY_FILTERS"].get(
            "role",
        ):
            return extra_filters(query)

        return query


class FilterRelatedTables(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    A filter to allow searching for related tables.
    Use in the api by adding something like:
    related_field_filters = {
      "tables": RelatedFieldFilter("table_name", FilterRelatedTables),
    }
    """

    name = lazy_gettext("Table")
    arg_name = "tables"

    def apply(self, query: Query, value: Optional[Any]) -> Query:
        from superset.connectors.sqla.models import SqlaTable

        like_value = "%" + cast(str, value) + "%"
        return query.filter(SqlaTable.table_name.ilike(like_value))


class BaseDeletedStateFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """Base class for ``*_deleted_state`` rison filters.

    Subclasses set ``arg_name`` (e.g. ``"chart_deleted_state"``) and
    ``model`` (the SoftDeleteMixin model class). Values:

      * ``include``  — return live + soft-deleted rows
      * ``only``     — return only soft-deleted rows
      * absent / any other value — default behaviour (live rows only)

    When ``include`` or ``only`` is set, the filter sets
    ``g.skip_visibility_filter = True`` so the do_orm_execute listener
    at ``superset.models.helpers._add_soft_delete_filter`` opts the
    request out of the global soft-delete WHERE clause. The mutation
    happens during query construction (before execution), so the flag
    is in place by the time the listener fires.
    """

    name = lazy_gettext("Deleted state")
    model: Any  # set by subclass — a class with a ``deleted_at`` column

    def apply(self, query: Query, value: Any) -> Query:
        from flask import g

        from superset.models.helpers import SKIP_VISIBILITY_FILTER

        normalized = str(value).lower().strip() if value is not None else ""
        if normalized == "include":
            self._opt_out_of_visibility_filter(g, SKIP_VISIBILITY_FILTER)
            return query
        if normalized == "only":
            self._opt_out_of_visibility_filter(g, SKIP_VISIBILITY_FILTER)
            return query.filter(self.model.deleted_at.is_not(None))
        return query

    @staticmethod
    def _opt_out_of_visibility_filter(g: Any, key: str) -> None:
        """Set the request-scoped flag so the do_orm_execute listener
        bypasses the soft-delete WHERE clause for the rest of the
        request. Named to make the side effect visible at the call site.
        """
        setattr(g, key, True)
