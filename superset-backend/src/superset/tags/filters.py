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
from __future__ import annotations

from typing import Any

from flask_babel import lazy_gettext as _
from sqlalchemy.orm import Query

from superset.connectors.sqla.models import SqlaTable
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.sql_lab import Query as SqllabQuery
from superset.tags.models import Tag, TagType
from superset.views.base import BaseFilter


class UserCreatedTagTypeFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Filter for tag type.
    When set to True, only user-created tags are returned.
    When set to False, only system tags are returned.
    """

    name = _("Is custom tag")
    arg_name = "custom_tag"

    def apply(self, query: Query, value: bool) -> Query:
        if value:
            return query.filter(Tag.type == TagType.custom)
        if value is False:
            return query.filter(Tag.type != TagType.custom)
        return query


class BaseTagNameFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Base Custom filter for the GET list that filters all dashboards, slices
    and saved queries associated with a tag (by the tag name).
    """

    name = _("Is tagged")
    arg_name = ""
    class_name = ""
    """ The Tag class_name to user """
    model: type[Dashboard | Slice | SqllabQuery | SqlaTable] = Dashboard
    """ The SQLAlchemy model """

    def apply(self, query: Query, value: Any) -> Query:
        ilike_value = f"%{value}%"
        tags_query = (
            db.session.query(self.model.id)
            .join(self.model.tags)
            .filter(Tag.name.ilike(ilike_value))
        )
        return query.filter(self.model.id.in_(tags_query))


class BaseTagIdFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Base Custom filter for the GET list that filters all dashboards, slices
    and saved queries associated with a tag (by the tag ID).
    """

    name = _("Is tagged")
    arg_name = ""
    class_name = ""
    """ The Tag class_name to user """
    model: type[Dashboard | Slice | SqllabQuery | SqlaTable] = Dashboard
    """ The SQLAlchemy model """

    def apply(self, query: Query, value: Any) -> Query:
        tags_query = (
            db.session.query(self.model.id)
            .join(self.model.tags)
            .filter(Tag.id == value)
        )
        return query.filter(self.model.id.in_(tags_query))
