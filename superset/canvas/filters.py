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

from flask_appbuilder.models.sqla.filters import BaseFilter
from sqlalchemy import false, or_
from sqlalchemy.orm.query import Query

from superset.extensions import db, security_manager
from superset.models.canvas import Canvas
from superset.utils.core import get_user_id


class CanvasAccessFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """Scope canvases to the current user's editor/viewer grants.

    Mirrors the chart/dashboard editors-viewers pattern (see
    ``superset/charts/filters.py``); admins are unfiltered.
    """

    def apply(self, query: Query, value: Any) -> Query:
        if security_manager.is_admin():
            return query

        from superset.subjects.models import canvas_editors, canvas_viewers
        from superset.subjects.utils import get_user_subject_ids_subquery

        user_id = get_user_id()
        if not user_id:
            return query.filter(false())

        subject_subquery = get_user_subject_ids_subquery(user_id)
        editor_query = (
            db.session.query(Canvas.id)
            .join(canvas_editors, Canvas.id == canvas_editors.c.canvas_id)
            .filter(canvas_editors.c.subject_id.in_(subject_subquery))
        )
        viewer_query = (
            db.session.query(Canvas.id)
            .join(canvas_viewers, Canvas.id == canvas_viewers.c.canvas_id)
            .filter(canvas_viewers.c.subject_id.in_(subject_subquery))
        )
        return query.filter(
            or_(Canvas.id.in_(editor_query), Canvas.id.in_(viewer_query))
        )
