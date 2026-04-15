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
"""A collection of ORM sqlalchemy models for Superset"""

import logging
from typing import Any, Optional

import prison
from cron_descriptor import get_description
from flask_appbuilder import Model
from flask_appbuilder.models.decorators import renders
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import backref, relationship
from sqlalchemy.schema import UniqueConstraint
from sqlalchemy_utils import UUIDType

from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.helpers import AuditMixinNullable, ExtraJSONMixin
from superset.models.slice import Slice
from superset.reports.types import ReportScheduleExtra
from superset.subjects.models import report_schedule_editors, Subject
from superset.subjects.types import SubjectType
from superset.utils.backports import StrEnum
from superset.utils.core import MediumText

logger = logging.getLogger(__name__)

metadata = Model.metadata  # pylint: disable=no-member


class ReportScheduleType(StrEnum):
    ALERT = "Alert"
    REPORT = "Report"


class ReportScheduleValidatorType(StrEnum):
    """Validator types for alerts"""

    NOT_NULL = "not null"
    OPERATOR = "operator"


class ReportRecipientType(StrEnum):
    EMAIL = "Email"
    SLACK = "Slack"
    SLACKV2 = "SlackV2"
    WEBHOOK = "Webhook"


class ReportState(StrEnum):
    SUCCESS = "Success"
    WORKING = "Working"
    ERROR = "Error"
    NOOP = "Not triggered"
    GRACE = "On Grace"


class ReportDataFormat(StrEnum):
    PDF = "PDF"
    PNG = "PNG"
    CSV = "CSV"
    TEXT = "TEXT"


class ReportCreationMethod(StrEnum):
    CHARTS = "charts"
    DASHBOARDS = "dashboards"
    ALERTS_REPORTS = "alerts_reports"


class ReportSourceFormat(StrEnum):
    CHART = "chart"
    DASHBOARD = "dashboard"


class ReportSchedule(AuditMixinNullable, ExtraJSONMixin, Model):
    """
    Report Schedules, supports alerts and reports
    """

    __tablename__ = "report_schedule"
    __table_args__ = (UniqueConstraint("name", "type"),)

    id = Column(Integer, primary_key=True)
    type = Column(String(50), nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    context_markdown = Column(Text)
    active = Column(Boolean, default=True, index=True)
    crontab = Column(String(1000), nullable=False)
    creation_method = Column(
        String(255), server_default=ReportCreationMethod.ALERTS_REPORTS
    )
    timezone = Column(String(100), default="UTC", nullable=False)
    report_format = Column(String(50), default=ReportDataFormat.PNG)
    sql = Column(MediumText())
    # (Alerts/Reports) M-O to chart
    chart_id = Column(Integer, ForeignKey("slices.id"), nullable=True)
    chart = relationship(Slice, backref="report_schedules", foreign_keys=[chart_id])
    # (Alerts/Reports) M-O to dashboard
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=True)
    dashboard = relationship(
        Dashboard, backref="report_schedules", foreign_keys=[dashboard_id]
    )
    # (Alerts) M-O to database
    database_id = Column(Integer, ForeignKey("dbs.id"), nullable=True)
    database = relationship(Database, foreign_keys=[database_id])
    editors = relationship(
        Subject,
        secondary=report_schedule_editors,
        passive_deletes=True,
    )

    @property
    def owners(self) -> list[Any]:
        """Derive owners from user-type editors (backwards compat)."""
        return [s.user for s in self.editors if s.type == SubjectType.USER and s.user]

    # (Alerts) Stamped last observations
    last_eval_dttm = Column(DateTime)
    last_state = Column(String(50), default=ReportState.NOOP)
    last_value = Column(Float)
    last_value_row_json = Column(MediumText())

    # (Alerts) Observed value validation related columns
    validator_type = Column(String(100))
    validator_config_json = Column(MediumText(), default="{}")

    # Log retention
    log_retention = Column(Integer, default=90)
    # (Alerts) After a success how long to wait for a new trigger (seconds)
    grace_period = Column(Integer, default=60 * 60 * 4)
    # (Alerts/Reports) Unlock a possible stalled working state
    working_timeout = Column(Integer, default=60 * 60 * 1)

    # (Reports) When generating a screenshot, bypass the cache?
    force_screenshot = Column(Boolean, default=False)

    custom_width = Column(Integer, nullable=True)
    custom_height = Column(Integer, nullable=True)

    extra: ReportScheduleExtra  # type: ignore

    email_subject = Column(String(255))

    def __repr__(self) -> str:
        return str(self.name)

    @renders("crontab")
    def crontab_humanized(self) -> str:
        return get_description(self.crontab)

    def get_native_filters_params(self) -> tuple[str, list[str]]:
        """
        Generate native filter params for dashboard URL.

        Returns:
            A tuple of (rison_encoded_params, list_of_warning_messages).
            Warnings are returned so they can be surfaced to users in the
            execution log.
        """
        params: dict[str, Any] = {}
        warnings: list[str] = []
        dashboard = self.extra.get("dashboard")
        if dashboard and dashboard.get("nativeFilters"):
            native_filters = dashboard.get("nativeFilters") or []
            for native_filter in native_filters:  # type: ignore
                native_filter_id = native_filter.get("nativeFilterId")
                filter_type = native_filter.get("filterType")

                if native_filter_id is None or filter_type is None:
                    warning_msg = (
                        f"Skipping malformed native filter missing required "
                        f"fields: {native_filter}"
                    )
                    warnings.append(warning_msg)
                    logger.warning(warning_msg)
                    continue

                filter_config, filter_warning = self._generate_native_filter(
                    native_filter_id,
                    filter_type,
                    native_filter.get("columnName") or "",
                    native_filter.get("filterValues") or [],
                )
                if filter_warning:
                    warnings.append(filter_warning)
                params = {**params, **filter_config}
        # hack(hughhh): workaround for escaping prison not handling quotes right
        rison = prison.dumps(params)
        rison = rison.replace("'", "%27")
        return rison, warnings

    def _generate_native_filter(
        self,
        native_filter_id: str,
        filter_type: str,
        column_name: str,
        values: list[Optional[str]],
    ) -> tuple[dict[str, Any], Optional[str]]:
        """
        Generate a native filter configuration for the given filter type.

        Returns:
            A tuple of (filter_config, warning_message). If the filter type is
            unrecognized, returns an empty dict and a warning message.
        """
        # Filter types that require at least one value
        requires_values = (
            "filter_time",
            "filter_timegrain",
            "filter_timecolumn",
            "filter_range",
        )
        if filter_type in requires_values and not values:
            warning_msg = (
                f"Skipping {filter_type} with empty filterValues "
                f"(filter_id: {native_filter_id})"
            )
            logger.warning(warning_msg)
            return {}, warning_msg

        if filter_type == "filter_time":
            return (
                {
                    native_filter_id or "": {
                        "id": native_filter_id or "",
                        "extraFormData": {"time_range": values[0]},
                        "filterState": {"value": values[0]},
                        "ownState": {},
                    }
                },
                None,
            )
        if filter_type == "filter_timegrain":
            return (
                {
                    native_filter_id or "": {
                        "id": native_filter_id or "",
                        "extraFormData": {
                            "time_grain_sqla": values[0],  # grain
                        },
                        "filterState": {
                            # "label": "30 second", # grain_label
                            "value": values  # grain
                        },
                        "ownState": {},
                    }
                },
                None,
            )

        if filter_type == "filter_timecolumn":
            return (
                {
                    native_filter_id or "": {
                        "extraFormData": {
                            "granularity_sqla": values[0]  # column_name
                        },
                        "filterState": {
                            "value": values  # column_name
                        },
                    }
                },
                None,
            )

        if filter_type == "filter_select":
            return (
                {
                    native_filter_id or "": {
                        "id": native_filter_id or "",
                        "extraFormData": {
                            "filters": [
                                {
                                    "col": column_name or "",
                                    "op": "IN",
                                    "val": values or [],
                                }
                            ]
                        },
                        "filterState": {
                            "label": column_name or "",
                            "validateStatus": False,
                            "value": values or [],
                        },
                        "ownState": {},
                    }
                },
                None,
            )
        if filter_type == "filter_range":
            # For range filters, values should be [min, max] or [value] for single value
            min_val = values[0] if len(values) > 0 else None
            max_val = values[1] if len(values) > 1 else None

            filters = []
            if min_val is not None:
                filters.append({"col": column_name or "", "op": ">=", "val": min_val})
            if max_val is not None:
                filters.append({"col": column_name or "", "op": "<=", "val": max_val})

            return (
                {
                    native_filter_id or "": {
                        "id": native_filter_id or "",
                        "extraFormData": {"filters": filters},
                        "filterState": {
                            "value": [min_val, max_val],
                            "label": f"{min_val} ≤ x ≤ {max_val}"
                            if min_val is not None and max_val is not None
                            else f"x ≥ {min_val}"
                            if min_val is not None
                            else f"x ≤ {max_val}"
                            if max_val is not None
                            else "",
                        },
                        "ownState": {},
                    }
                },
                None,
            )

        warning_msg = (
            f"Skipping native filter with unrecognized filter type '{filter_type}' "
            f"(filter_id: {native_filter_id})"
        )
        logger.warning(warning_msg)
        return {}, warning_msg


class ReportRecipients(Model, AuditMixinNullable):
    """
    Report Recipients, meant to support multiple notification types, eg: Slack, email
    """

    __tablename__ = "report_recipient"
    id = Column(Integer, primary_key=True)
    type = Column(String(50), nullable=False)
    recipient_config_json = Column(MediumText(), default="{}")
    report_schedule_id = Column(
        Integer, ForeignKey("report_schedule.id"), nullable=False
    )
    report_schedule = relationship(
        ReportSchedule,
        backref=backref("recipients", cascade="all,delete,delete-orphan"),
        foreign_keys=[report_schedule_id],
    )

    __table_args__ = (
        Index("ix_report_recipient_report_schedule_id", report_schedule_id),
    )


class ReportExecutionLog(Model):  # pylint: disable=too-few-public-methods
    """
    Report Execution Log, hold the result of the report execution with timestamps,
    last observation and possible error messages
    """

    __tablename__ = "report_execution_log"
    id = Column(Integer, primary_key=True)
    uuid = Column(UUIDType(binary=True))

    # Timestamps
    scheduled_dttm = Column(DateTime, nullable=False)
    start_dttm = Column(DateTime)
    end_dttm = Column(DateTime)

    # (Alerts) Observed values
    value = Column(Float)
    value_row_json = Column(MediumText())

    state = Column(String(50), nullable=False)
    error_message = Column(Text)

    report_schedule_id = Column(
        Integer, ForeignKey("report_schedule.id"), nullable=False
    )
    report_schedule = relationship(
        ReportSchedule,
        backref=backref("logs", cascade="all,delete,delete-orphan"),
        foreign_keys=[report_schedule_id],
    )

    __table_args__ = (
        Index("ix_report_execution_log_report_schedule_id", report_schedule_id),
        Index("ix_report_execution_log_start_dttm", start_dttm),
    )
