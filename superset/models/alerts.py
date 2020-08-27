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
"""Models for scheduled execution of jobs"""
import enum
import textwrap
from datetime import datetime
from typing import Any, List, Optional

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
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import backref, relationship, RelationshipProperty

from superset import db, security_manager

metadata = Model.metadata  # pylint: disable=no-member


alert_owner = Table(
    "alert_owner",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("ab_user.id")),
    Column("alert_id", Integer, ForeignKey("alerts.id")),
)


class AlertValidatorType(str, enum.Enum):
    not_null = "Not Null"
    gte_threshold = "Greater Than or Equal To"
    lte_threshold = "Less Than or Equal To"


class Alert(Model):

    """Schedules for emailing slices / dashboards"""

    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True)
    label = Column(String(150), nullable=False)
    active = Column(Boolean, default=True, index=True)
    crontab = Column(String(50), nullable=False)

    alert_type = Column(String(50))
    owners = relationship(security_manager.user_model, secondary=alert_owner)
    recipients = Column(Text)
    slack_channel = Column(Text)

    # TODO: implement log_retention
    log_retention = Column(Integer, default=90)
    grace_period = Column(Integer, default=60 * 60 * 24)

    slice_id = Column(Integer, ForeignKey("slices.id"))
    slice = relationship("Slice", backref="alerts", foreign_keys=[slice_id])

    dashboard_id = Column(Integer, ForeignKey("dashboards.id"))
    dashboard = relationship("Dashboard", backref="alert", foreign_keys=[dashboard_id])

    last_eval_dttm = Column(DateTime, default=datetime.utcnow)
    last_state = Column(String(10))

    def __str__(self) -> str:
        return f"<{self.id}:{self.label}>"


class AlertLog(Model):
    """Keeps track of alert-related operations"""

    __tablename__ = "alert_logs"

    id = Column(Integer, primary_key=True)
    scheduled_dttm = Column(DateTime)
    dttm_start = Column(DateTime, default=datetime.utcnow)
    dttm_end = Column(DateTime, default=datetime.utcnow)
    alert_id = Column(Integer, ForeignKey("alerts.id"))
    alert = relationship("Alert", backref="logs", foreign_keys=[alert_id])
    state = Column(String(10))

    @property
    def duration(self) -> int:
        return (self.dttm_end - self.dttm_start).total_seconds()


# TODO: Currently SQLObservation table will constantly grow with no limit,
# add some retention restriction or more to a more scalable db e.g.
# https://github.com/apache/incubator-superset/blob/master/superset/utils/log.py#L32
class SQLObserver(Model):
    """Runs SQL-based queries for alerts"""

    __tablename__ = "sql_observers"

    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False)
    sql = Column(Text, nullable=False)

    @declared_attr
    def alert_id(self) -> int:
        return Column(Integer, ForeignKey("alerts.id"), nullable=False)

    @declared_attr
    def alert(self) -> RelationshipProperty:
        return relationship(
            "Alert",
            foreign_keys=[self.alert_id],
            backref=backref("sql_observer", cascade="all, delete-orphan"),
        )

    @declared_attr
    def database_id(self) -> int:
        return Column(Integer, ForeignKey("dbs.id"), nullable=False)

    @declared_attr
    def database(self) -> RelationshipProperty:
        return relationship(
            "Database",
            foreign_keys=[self.database_id],
            backref=backref("sql_observers", cascade="all, delete-orphan"),
        )

    def get_observations(self, observation_num: Optional[int] = 2) -> List[Any]:
        return (
            db.session.query(SQLObservation)
            .filter_by(observer_id=self.id)
            .order_by(SQLObservation.dttm.desc())
            .limit(observation_num)
        )


class SQLObservation(Model):  # pylint: disable=too-few-public-methods
    """Keeps track of values retrieved from SQLObservers"""

    __tablename__ = "sql_observations"

    id = Column(Integer, primary_key=True)
    dttm = Column(DateTime, default=datetime.utcnow, index=True)
    observer_id = Column(Integer, ForeignKey("sql_observers.id"), nullable=False)
    observer = relationship(
        "SQLObserver",
        foreign_keys=[observer_id],
        backref=backref("observations", cascade="all, delete-orphan"),
    )
    alert_id = Column(Integer, ForeignKey("alerts.id"))
    alert = relationship(
        "Alert",
        foreign_keys=[alert_id],
        backref=backref("observations", cascade="all, delete-orphan"),
    )
    value = Column(Float)
    valid_result = Column(Boolean, default=True)


class Validator(Model):
    """Used to determine how an alert and its observations should be validated"""

    __tablename__ = "alert_validators"

    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False)
    validator_type = Column(Enum(AlertValidatorType))
    config = Column(
        Text,
        default=textwrap.dedent(
            """
            {

            }
            """
        ),
    )

    @declared_attr
    def alert_id(self) -> int:
        return Column(Integer, ForeignKey("alerts.id"), nullable=False)

    @declared_attr
    def alert(self) -> RelationshipProperty:
        return relationship(
            "Alert",
            foreign_keys=[self.alert_id],
            backref=backref("alert_validators", cascade="all, delete-orphan"),
        )
