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
"""Access and list filters for saved widgets."""

from typing import Any

from flask_babel import lazy_gettext as _
from sqlalchemy import false, or_
from sqlalchemy.orm.query import Query

from superset import db, security_manager
from superset.subjects.filters import EditableFilter
from superset.subjects.models import widget_editors, widget_viewers
from superset.utils.core import get_user_id
from superset.views.base import BaseFilter
from superset.widgets.models import Widget


class WidgetFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Base filter for the widgets a user may read.

    Admins see every widget; other users see the widgets where one of their
    subjects (user, role or group) is an editor or a viewer. Embedded guests see
    none, because no embedded surface exposes saved widgets.
    """

    def apply(self, query: Query, value: Any) -> Query:
        if security_manager.is_guest_user():
            return query.filter(false())

        if security_manager.is_admin():
            return query

        user_id = get_user_id()
        if not user_id:
            return query.filter(false())

        from superset.subjects.utils import get_user_subject_ids_subquery

        subject_ids = get_user_subject_ids_subquery(user_id)
        editor_widget_ids = db.session.query(widget_editors.c.widget_id).filter(
            widget_editors.c.subject_id.in_(subject_ids)
        )
        viewer_widget_ids = db.session.query(widget_viewers.c.widget_id).filter(
            widget_viewers.c.subject_id.in_(subject_ids)
        )
        return query.filter(
            or_(Widget.id.in_(editor_widget_ids), Widget.id.in_(viewer_widget_ids))
        )


class WidgetEditableFilter(EditableFilter):  # pylint: disable=too-few-public-methods
    """Filter for widgets the user can edit."""

    model = Widget
    editors_table = widget_editors
    editors_fk_column = "widget_id"


class WidgetAllTextFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("All Text")
    arg_name = "widget_all_text"

    def apply(self, query: Query, value: Any) -> Query:
        if not value:
            return query
        ilike_value = f"%{value}%"
        return query.filter(
            or_(
                Widget.name.ilike(ilike_value),
                Widget.description.ilike(ilike_value),
            )
        )
