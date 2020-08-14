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
from datetime import datetime
from typing import Any, List

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
from superset.sql_parse import ParsedQuery

metadata = Model.metadata  # pylint: disable=no-member


alert_owner = Table(
    "alert_owner",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("ab_user.id")),
    Column("alert_id", Integer, ForeignKey("alerts.id")),
)


class AlertValidationType(str, enum.Enum):
    numerical = "Numerical"


class DeviationValidatorType(str, enum.Enum):
    range = "Range"
    threshold = "Threshold"
    percent_difference = "Percent Difference"
    integer_difference = "Integer Difference"


class Alert(Model):

    """Schedules for emailing slices / dashboards"""

    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True)
    label = Column(String(150))
    active = Column(Boolean, default=True, index=True)
    crontab = Column(String(50))

    alert_type = Column(String(50))
    owners = relationship(security_manager.user_model, secondary=alert_owner)
    recipients = Column(Text)
    slack_channel = Column(Text)

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


class Observer:

    __tablename__ = "alert_observers"

    id = Column(Integer, primary_key=True)
    name = Column(String(150))
    validation_type = Column(Enum(AlertValidationType))

    @declared_attr
    def alert_id(self) -> int:
        return Column(Integer, ForeignKey("alerts.id"), nullable=False)

    @declared_attr
    def alert(self) -> RelationshipProperty:
        return relationship(
            "Alert", foreign_keys=[self.alert_id], backref=self.__tablename__[:-1]
        )

    @declared_attr
    def database_id(self) -> int:
        return Column(Integer, ForeignKey("dbs.id"), nullable=False)

    @declared_attr
    def database(self) -> RelationshipProperty:
        return relationship(
            "Database",
            foreign_keys=[self.database_id],
            backref=backref(self.__tablename__, cascade="all, delete-orphan"),
        )


class SQLObserver(Model, Observer):

    __tablename__ = "sql_alert_observers"

    sql = Column(Text)

    def query(self) -> None:
        parsed_query = ParsedQuery(self.sql)
        sql = parsed_query.stripped()
        df = self.database.get_df(sql)

        self.observations.append(  # pylint: disable=no-member
            SQLObservation(dttm_ts=datetime.utcnow(), value=df.to_json())
        )

    def get_observations(self, observation_num: int) -> List[Any]:
        return (
            db.session.query(SQLObservation)
            .filter_by(observer_id=self.id)
            .order_by(Observation.dttm_ts.desc())
            .limit(observation_num)
        )


class Observation: # pylint: disable=too-few-public-methods

    __tablename__ = "observations"

    id = Column(Integer, primary_key=True)
    dttm_ts = Column(DateTime, default=datetime.utcnow)


class SQLObservation(Model, Observation): # pylint: disable=too-few-public-methods

    __tablename__ = "sql_alert_observations"

    observer_id = Column(Integer, ForeignKey("sql_alert_observers.id"), nullable=False)
    observer = relationship(
        "SQLObserver", foreign_keys=[observer_id], backref="observations",
    )
    value = Column(Text)


class Validator:

    __tablename__ = "alert_validators"  # pylint: disable=too-few-public-methods

    id = Column(Integer, primary_key=True)
    name = Column(String(150))
    validation_type = Column(Enum(AlertValidationType))

    @declared_attr
    def alert_id(self) -> int:
        return Column(Integer, ForeignKey("alerts.id"), nullable=False)

    @declared_attr
    def alert(self) -> RelationshipProperty:
        return relationship(
            "Alert", foreign_keys=[self.alert_id], backref=self.__tablename__
        )


class NotNullValidator(Model, Validator):

    __tablename__ = "not_null_alert_validators"

    def validate(self, observation: Observation) -> None:
        pass


class DeviationValidator(Model, Validator):

    __tablename__ = "deviation_alert_validators"

    deviation_difference = Column(Float)
    deviation_threshold = Column(Integer)
    range_min = Column(Integer)
    range_max = Column(Integer)

    def validate(self, observations: List[Observation]) -> None:
        pass
