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
"""List and access filters for canvases."""

from __future__ import annotations

from typing import Any

from flask import current_app
from flask_babel import lazy_gettext as _
from sqlalchemy import or_
from sqlalchemy.orm.query import Query

from superset import db, security_manager
from superset.models.canvas import Canvas
from superset.subjects.filters import (
    EditableFilter,
    subject_relation_exists_for_current_user,
)
from superset.subjects.models import canvas_editors, canvas_viewers
from superset.utils.core import get_user_id
from superset.views.base import BaseFilter


class CanvasAccessFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    The canvases the current user can see: admins see all; everyone else sees
    the canvases they edit or view. Embedded guests see none.
    """

    def apply(self, query: Query, value: Any) -> Query:
        if security_manager.is_guest_user():
            return query.filter(Canvas.id < 0)
        if security_manager.is_admin():
            return query

        filters = [
            Canvas.id.in_(
                db.session.query(table.c.canvas_id).filter(
                    subject_relation_exists_for_current_user(table)
                )
            )
            for table in (canvas_editors, canvas_viewers)
        ]
        extra_filters = current_app.config.get("EXTRA_ACCESS_QUERY_FILTERS", {})
        if (extra_canvases_filter := extra_filters.get("canvases")) and (
            user_id := get_user_id()
        ):
            filters.append(Canvas.id.in_(extra_canvases_filter(user_id)))
        return query.filter(or_(*filters))


class CanvasEditableFilter(EditableFilter):  # pylint: disable=too-few-public-methods
    model = Canvas
    editors_table = canvas_editors
    editors_fk_column = "canvas_id"


class CanvasAllTextFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("All Text")
    arg_name = "canvas_all_text"

    def apply(self, query: Query, value: Any) -> Query:
        if not value:
            return query
        ilike_value = f"%{value}%"
        return query.filter(
            or_(Canvas.title.ilike(ilike_value), Canvas.description.ilike(ilike_value))
        )
