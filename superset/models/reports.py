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
# pylint: disable=line-too-long,unused-argument,ungrouped-imports
"""A collection of ORM sqlalchemy models for Superset"""
import enum

from flask_appbuilder import Model
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.schema import UniqueConstraint

from superset.extensions import security_manager
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice

metadata = Model.metadata  # pylint: disable=no-member


class ReportScheduleType(str, enum.Enum):
    alert = "alert"
    report = "report"


class ReportRecipientType(str, enum.Enum):
    email = "email"
    slack = "slack"


class ReportLogState(str, enum.Enum):
    success = "success"
    error = "error"


class ReportEmailFormat(str, enum.Enum):
    visualization = "Visualization"
    data = "Raw data"


report_schedule_user = Table(
    "report_schedule_user",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("ab_user.id")),
    Column("report_schedule_id", Integer, ForeignKey("report_schedule.id")),
    UniqueConstraint("user_id", "report_schedule_id"),
)


class ReportSchedule(Model):

    """
    Report Schedules, supports alerts and reports
    """

    __tablename__ = "report_schedule"
    id = Column(Integer, primary_key=True)
    type = Column(Enum(ReportScheduleType, name="report_schedule_type"), nullable=False)
    label = Column(String(150), nullable=False, unique=True)
    active = Column(Boolean, default=True, index=True)
    crontab = Column(String(50), nullable=False)
    sql = Column(Text())
    # (Reports) M-O to chart
    chart_id = Column(Integer, ForeignKey("slice.id"), nullable=True)
    chart = relationship(Slice, backref="report_schedules", foreign_keys=[chart_id])
    # (Reports) M-O to dashboard
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=True)
    dashboard = relationship(
        Dashboard, backref="report_schedules", foreign_keys=[dashboard_id]
    )
    # (Alerts) M-O to database
    database_id = Column(Integer, ForeignKey("dbs.id"), nullable=True)
    database = relationship(Database, foreign_keys=[dashboard_id])
    owners = relationship(security_manager.user_model, secondary=report_schedule_user)

    # (Reports) email format
    email_format = Column(Enum(ReportEmailFormat, name="report_email_format"))

    # (Alerts) Stamped last observations
    last_eval_dttm = Column(DateTime, nullable=True)
    last_state = Column(Enum(ReportLogState, name="report_log_state"), nullable=False)
    last_value = Column(Float, nullable=True)
    last_value_row_json = Column(Text, nullable=True)

    # (Alerts) Observed value validation related columns
    validator_type = Column(String(100), nullable=True)
    validator_config_json = Column(Text, default="{}")

    # Log retention
    log_retention = Column(Integer, default=90)
    grace_period = Column(Integer, default=60 * 60 * 4)

    def __repr__(self) -> str:
        return str(self.label)


class ReportRecipients(Model):  # pylint: disable=too-few-public-methods

    """
    Report Recipients, meant to support multiple notification types, eg: Slack, email
    """

    __tablename__ = "report_recipient"
    id = Column(Integer, primary_key=True)
    type = Column(
        Enum(ReportRecipientType, name="report_recipient_type"), nullable=False
    )
    recipient_config_json = Column(Text, default="{}")
    report_schedule_id = Column(
        Integer, ForeignKey("report_schedule.id"), nullable=True
    )
    report_schedule = relationship(
        ReportSchedule, backref="recipients", foreign_keys=[report_schedule_id]
    )


class ReportExecutionLog(Model):  # pylint: disable=too-few-public-methods

    """
    Report Execution Log, hold the result of the report execution with timestamps,
    last observation and possible error messages
    """

    __tablename__ = "report_execution_log"
    id = Column(Integer, primary_key=True)

    # Timestamps
    start_dttm = Column(DateTime, nullable=True)
    end_dttm = Column(DateTime, nullable=True)

    # (Alerts) Observed values
    observation_dttm = Column(DateTime, nullable=True)
    value = Column(Float, nullable=True)
    value_row_json = Column(Text, nullable=True)

    state = Column(Enum(ReportLogState, name="report_log_state"), nullable=False)
    error_message = Column(Text, nullable=True)

    report_schedule_id = Column(
        Integer, ForeignKey("report_schedule.id"), nullable=True
    )
    report_schedule = relationship(
        ReportSchedule, backref="logs", foreign_keys=[report_schedule_id]
    )
