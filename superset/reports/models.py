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
import enum

from cron_descriptor import get_description
from flask_appbuilder import Model
from flask_appbuilder.models.decorators import renders
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import backref, relationship
from sqlalchemy.schema import UniqueConstraint
from sqlalchemy_utils import UUIDType

from superset.extensions import security_manager
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.helpers import AuditMixinNullable, ExtraJSONMixin
from superset.models.slice import Slice
from superset.reports.types import ReportScheduleExtra

metadata = Model.metadata  # pylint: disable=no-member


class ReportScheduleType(str, enum.Enum):
    ALERT = "Alert"
    REPORT = "Report"


class ReportScheduleValidatorType(str, enum.Enum):
    """Validator types for alerts"""

    NOT_NULL = "not null"
    OPERATOR = "operator"


class ReportRecipientType(str, enum.Enum):
    EMAIL = "Email"
    SLACK = "Slack"


class ReportState(str, enum.Enum):
    SUCCESS = "Success"
    WORKING = "Working"
    ERROR = "Error"
    NOOP = "Not triggered"
    GRACE = "On Grace"


class ReportDataFormat(str, enum.Enum):
    VISUALIZATION = "PNG"
    DATA = "CSV"
    TEXT = "TEXT"


class ReportCreationMethod(str, enum.Enum):
    CHARTS = "charts"
    DASHBOARDS = "dashboards"
    ALERTS_REPORTS = "alerts_reports"


class ReportSourceFormat(str, enum.Enum):
    CHART = "chart"
    DASHBOARD = "dashboard"


report_schedule_user = Table(
    "report_schedule_user",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("ab_user.id"), nullable=False),
    Column(
        "report_schedule_id", Integer, ForeignKey("report_schedule.id"), nullable=False
    ),
    UniqueConstraint("user_id", "report_schedule_id"),
)


class ReportSchedule(Model, AuditMixinNullable, ExtraJSONMixin):

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
    report_format = Column(String(50), default=ReportDataFormat.VISUALIZATION)
    sql = Column(Text())
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
    owners = relationship(security_manager.user_model, secondary=report_schedule_user)

    # (Alerts) Stamped last observations
    last_eval_dttm = Column(DateTime)
    last_state = Column(String(50), default=ReportState.NOOP)
    last_value = Column(Float)
    last_value_row_json = Column(Text)

    # (Alerts) Observed value validation related columns
    validator_type = Column(String(100))
    validator_config_json = Column(Text, default="{}")

    # Log retention
    log_retention = Column(Integer, default=90)
    # (Alerts) After a success how long to wait for a new trigger (seconds)
    grace_period = Column(Integer, default=60 * 60 * 4)
    # (Alerts/Reports) Unlock a possible stalled working state
    working_timeout = Column(Integer, default=60 * 60 * 1)

    # (Reports) When generating a screenshot, bypass the cache?
    force_screenshot = Column(Boolean, default=False)

    extra: ReportScheduleExtra  # type: ignore

    def __repr__(self) -> str:
        return str(self.name)

    @renders("crontab")
    def crontab_humanized(self) -> str:
        return get_description(self.crontab)


class ReportRecipients(Model, AuditMixinNullable):
    """
    Report Recipients, meant to support multiple notification types, eg: Slack, email
    """

    __tablename__ = "report_recipient"
    id = Column(Integer, primary_key=True)
    type = Column(String(50), nullable=False)
    recipient_config_json = Column(Text, default="{}")
    report_schedule_id = Column(
        Integer, ForeignKey("report_schedule.id"), nullable=False
    )
    report_schedule = relationship(
        ReportSchedule,
        backref=backref("recipients", cascade="all,delete,delete-orphan"),
        foreign_keys=[report_schedule_id],
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
    value_row_json = Column(Text)

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
