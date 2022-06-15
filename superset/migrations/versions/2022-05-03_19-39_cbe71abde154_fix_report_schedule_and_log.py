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
"""fix report schedule and execution log

Revision ID: cbe71abde154
Revises: a9422eeaae74
Create Date: 2022-05-03 19:39:32.074608

"""

# revision identifiers, used by Alembic.
revision = "cbe71abde154"
down_revision = "a9422eeaae74"

from alembic import op
from sqlalchemy import Column, Float, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.models.reports import ReportState

Base = declarative_base()


class ReportExecutionLog(Base):
    __tablename__ = "report_execution_log"

    id = Column(Integer, primary_key=True)
    state = Column(String(50), nullable=False)
    value = Column(Float)
    value_row_json = Column(Text)


class ReportSchedule(Base):
    __tablename__ = "report_schedule"

    id = Column(Integer, primary_key=True)
    last_state = Column(String(50))
    last_value = Column(Float)
    last_value_row_json = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for schedule in (
        session.query(ReportSchedule)
        .filter(ReportSchedule.last_state == ReportState.WORKING)
        .all()
    ):
        schedule.last_value = None
        schedule.last_value_row_json = None

    session.commit()

    for execution_log in (
        session.query(ReportExecutionLog)
        .filter(ReportExecutionLog.state == ReportState.WORKING)
        .all()
    ):
        execution_log.value = None
        execution_log.value_row_json = None

    session.commit()
    session.close()


def downgrade():
    pass
