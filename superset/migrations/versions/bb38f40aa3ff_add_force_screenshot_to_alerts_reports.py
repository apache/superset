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
"""Add force_screenshot to alerts/reports

Revision ID: bb38f40aa3ff
Revises: 31bb738bd1d2
Create Date: 2021-12-10 19:25:29.802949

"""

# revision identifiers, used by Alembic.
revision = "bb38f40aa3ff"
down_revision = "31bb738bd1d2"

import sqlalchemy as sa
from alembic import op
from sqlalchemy.ext.declarative import declarative_base

from superset import db

Base = declarative_base()


class ReportSchedule(Base):
    __tablename__ = "report_schedule"

    id = sa.Column(sa.Integer, primary_key=True)
    type = sa.Column(sa.String(50), nullable=False)
    force_screenshot = sa.Column(sa.Boolean, default=False)
    chart_id = sa.Column(sa.Integer, nullable=True)


def upgrade():
    with op.batch_alter_table("report_schedule") as batch_op:
        batch_op.add_column(sa.Column("force_screenshot", sa.Boolean(), default=False))

    bind = op.get_bind()
    session = db.Session(bind=bind)

    for report in session.query(ReportSchedule).all():
        # Update existing alerts that send chart screenshots so that the cache is
        # bypassed. We don't turn this one for dashboards because (1) it's currently
        # not supported but also because (2) it can be very expensive.
        report.force_screenshot = report.type == "Alert" and report.chart_id is not None

    session.commit()


def downgrade():
    with op.batch_alter_table("report_schedule") as batch_op:
        batch_op.drop_column("force_screenshot")
