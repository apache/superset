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
from sqlalchemy import or_
from sqlalchemy.orm.query import Query

from superset import db, is_feature_enabled, security_manager
from superset.reports.models import ReportSchedule
from superset.views.base import BaseFilter


class ReportScheduleFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    def apply(self, query: Query, value: Any) -> Query:
        if security_manager.can_access_all_datasources():
            return query

        if is_feature_enabled("ENABLE_VIEWERS"):
            return self._apply_viewers(query)
        return self._apply_legacy(query)

    def _apply_viewers(self, query: Query) -> Query:
        from superset.subjects.models import report_schedule_editors
        from superset.subjects.utils import get_user_subject_ids_subquery
        from superset.utils.core import get_user_id

        user_id = get_user_id()
        if not user_id:
            return query.filter(ReportSchedule.id < 0)

        subject_subquery = get_user_subject_ids_subquery(user_id)
        editor_query = (
            db.session.query(ReportSchedule.id)
            .join(
                report_schedule_editors,
                ReportSchedule.id == report_schedule_editors.c.report_schedule_id,
            )
            .filter(report_schedule_editors.c.subject_id.in_(subject_subquery))
        )
        return query.filter(ReportSchedule.id.in_(editor_query))

    def _apply_legacy(self, query: Query) -> Query:
        from superset.subjects.models import report_schedule_editors, Subject
        from superset.utils.core import get_user_id

        editor_ids_query = (
            db.session.query(report_schedule_editors.c.report_schedule_id)
            .join(
                Subject.__table__,
                Subject.__table__.c.id == report_schedule_editors.c.subject_id,
            )
            .filter(
                Subject.__table__.c.type == 1,
                Subject.__table__.c.user_id == get_user_id(),
            )
        )
        return query.filter(ReportSchedule.id.in_(editor_ids_query))


class ReportScheduleAllTextFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("All Text")
    arg_name = "report_all_text"

    def apply(self, query: Query, value: Any) -> Query:
        if not value:
            return query
        ilike_value = f"%{value}%"
        return query.filter(
            or_(
                ReportSchedule.name.ilike(ilike_value),
                ReportSchedule.description.ilike(ilike_value),
                ReportSchedule.sql.ilike(ilike_value),
            )
        )
