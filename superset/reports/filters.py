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

from superset import db, security_manager
from superset.charts.filters import ChartFilter
from superset.daos.base import _escape_like
from superset.dashboards.filters import DashboardAccessFilter
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.reports.models import ReportExecutionLog, ReportSchedule
from superset.subjects.filters import subject_relation_exists_for_current_user
from superset.utils.filters import apply_extra_access_exclusions
from superset.views.base import BaseFilter


class ReportScheduleFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    def apply(self, query: Query, value: Any) -> Query:
        if security_manager.can_access_all_datasources():
            return query

        return self._apply_editors(query)

    def _apply_editors(self, query: Query) -> Query:
        from superset.subjects.models import report_schedule_editors

        editor_ids_query = db.session.query(
            report_schedule_editors.c.report_schedule_id
        ).filter(subject_relation_exists_for_current_user(report_schedule_editors))
        return query.filter(ReportSchedule.id.in_(editor_ids_query))


class ReportExecutionLogFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Scope execution logs to report schedules the user can edit, mirroring
    ``ReportScheduleFilter`` on the schedule API. Logs carry evaluated alert
    values and database error messages, so they must not be readable across
    ownership boundaries via an attacker-chosen schedule id.

    The unrestricted bypass is gated by ``can_access_all_queries`` rather
    than ``can_access_all_datasources``: the latter is also granted to
    stock Alpha, which would let a non-editor Alpha user read every other
    schedule's evaluated values and database errors. ``can_access_all_queries``
    is the admin-only permission this codebase already uses to gate the
    equivalent per-execution data on SQL Lab query history
    (see ``superset.queries.filters.QueryFilter``).
    """

    def apply(self, query: Query, value: Any) -> Query:
        if security_manager.can_access_all_queries():
            return query

        from superset.subjects.models import report_schedule_editors

        editor_ids_query = db.session.query(
            report_schedule_editors.c.report_schedule_id
        ).filter(subject_relation_exists_for_current_user(report_schedule_editors))
        return query.filter(ReportExecutionLog.report_schedule_id.in_(editor_ids_query))


class ReportScheduleAllTextFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("All Text")
    arg_name = "report_all_text"

    def apply(self, query: Query, value: Any) -> Query:
        if not value:
            return query
        # ``value`` may arrive as a non-string (e.g. an int in the API ``filters``
        # array); coerce it so escaping never raises on ``.replace``.
        ilike_value = f"%{_escape_like(str(value))}%"
        return query.filter(
            or_(
                ReportSchedule.name.ilike(ilike_value, escape="\\"),
                ReportSchedule.description.ilike(ilike_value, escape="\\"),
                ReportSchedule.sql.ilike(ilike_value, escape="\\"),
            )
        )


class ReportTargetChartFilter(ChartFilter):  # pylint: disable=too-few-public-methods
    """Charts selectable as the target of a scheduled report.

    A scheduled report is not rendered by the user who creates it: it runs later,
    as whichever principal the deployment configures as its executor. So a
    deployment can hold assets a user may read themselves but may not schedule a
    report on, and that is a narrower question than ordinary chart visibility.

    Only the exclusion key differs; every other rule is inherited. The exclusion
    is applied before delegating so it survives the parent's short-circuits.
    """

    def apply(self, query: Query, value: Any) -> Query:
        query = apply_extra_access_exclusions(query, "report_target_charts", Slice.id)
        return super().apply(query, value)


class ReportTargetDashboardFilter(  # pylint: disable=too-few-public-methods
    DashboardAccessFilter
):
    """Dashboards selectable as the target of a scheduled report.

    See :class:`ReportTargetChartFilter`.
    """

    def apply(self, query: Query, value: Any) -> Query:
        query = apply_extra_access_exclusions(
            query, "report_target_dashboards", Dashboard.id
        )
        return super().apply(query, value)
