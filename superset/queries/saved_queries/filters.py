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
from flask_sqlalchemy import BaseQuery
from sqlalchemy import or_
from sqlalchemy.orm.query import Query

from superset import security_manager
from superset.models.sql_lab import SavedQuery
from superset.tags.filters import BaseTagIdFilter, BaseTagNameFilter
from superset.utils.core import get_user_id
from superset.views.base import BaseFilter
from superset.views.base_api import BaseFavoriteFilter


class SavedQueryAllTextFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("All Text")
    arg_name = "all_text"

    def apply(self, query: Query, value: Any) -> Query:
        if not value:
            return query
        ilike_value = f"%{value}%"
        return query.filter(
            or_(
                SavedQuery.schema.ilike(ilike_value),
                SavedQuery.label.ilike(ilike_value),
                SavedQuery.description.ilike(ilike_value),
                SavedQuery.sql.ilike(ilike_value),
            )
        )


class SavedQueryFavoriteFilter(BaseFavoriteFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all saved queries that a user has
    favored
    """

    arg_name = "saved_query_is_fav"
    class_name = "query"
    model = SavedQuery


class SavedQueryTagNameFilter(BaseTagNameFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all saved queries associated with
    a certain tag (by its name).
    """

    arg_name = "saved_query_tags"
    class_name = "query"
    model = SavedQuery


class SavedQueryTagIdFilter(BaseTagIdFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all saved queries associated with
    a certain tag (by its ID).
    """

    arg_name = "saved_query_tag_id"
    class_name = "query"
    model = SavedQuery


class SavedQueryFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    def apply(self, query: BaseQuery, value: Any) -> BaseQuery:
        """
        Filters saved queries to include:
        - Queries owned by the current user
        - Queries accessible by users with 'can read' permission on SavedQuery
        """
        user_id = get_user_id()

        if security_manager.can_access("can_read", "SavedQuery"):
            return query

        return query.filter(SavedQuery.user_id == user_id)
