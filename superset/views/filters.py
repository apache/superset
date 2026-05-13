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

from flask import current_app as app, g
from flask_appbuilder.models.filters import BaseFilter
from flask_babel import lazy_gettext
from sqlalchemy import and_, or_
from sqlalchemy.orm import Query

from superset import security_manager
from superset.models.helpers import SKIP_VISIBILITY_FILTER

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


AUGMENT_RESPONSE_WITH_DELETED_AT = "_augment_response_with_deleted_at"


class BaseDeletedStateFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """Base class for ``*_deleted_state`` rison filters.

    Subclasses set ``arg_name`` (e.g. ``"chart_deleted_state"``) and
    ``model`` (the SoftDeleteMixin model class). Values:

      * ``include``  — return live + soft-deleted rows
      * ``only``     — return only soft-deleted rows
      * absent / any other value — default behaviour (live rows only)

    Scope decisions:

      * The visibility-filter bypass is applied **per-query** via
        ``query.execution_options(skip_visibility_filter=True)`` so it
        affects only the primary list query for this entity, not any
        incidental relationship loads or helper queries the request
        might issue against other ``SoftDeleteMixin`` models.
      * The response-augmentation step (which adds a ``deleted_at``
        field to each result row) is signalled via a separate
        request-scoped flag ``g._augment_response_with_deleted_at``.
        Keeping the two concerns separate prevents the broad
        per-request bypass from leaking soft-deleted rows of unrelated
        entities into the response.
    """

    name = lazy_gettext("Deleted state")
    model: Any  # set by subclass — a class with a ``deleted_at`` column

    def apply(self, query: Query, value: Any) -> Query:
        normalized = str(value).lower().strip() if value is not None else ""
        if normalized == "include":
            self._mark_response_for_deleted_at_augmentation()
            return query.execution_options(**{SKIP_VISIBILITY_FILTER: True})
        if normalized == "only":
            self._mark_response_for_deleted_at_augmentation()
            return query.execution_options(**{SKIP_VISIBILITY_FILTER: True}).filter(
                self.model.deleted_at.is_not(None)
            )
        return query

    @staticmethod
    def _mark_response_for_deleted_at_augmentation() -> None:
        """Signal to ``BaseSupersetModelRestApi.pre_get_list`` that this
        request opted into surfacing soft-deleted rows, so the response
        rows should be augmented with their ``deleted_at`` value.

        Distinct from the visibility-filter bypass, which is applied
        per-query on the list query itself.
        """
        setattr(g, AUGMENT_RESPONSE_WITH_DELETED_AT, True)
