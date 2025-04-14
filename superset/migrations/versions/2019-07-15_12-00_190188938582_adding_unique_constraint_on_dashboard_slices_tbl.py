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
"""Remove duplicated entries in dashboard_slices table and add unique constraint

Revision ID: 190188938582
Revises: d6ffdf31bdd4
Create Date: 2019-07-15 12:00:32.267507

"""

import logging

from alembic import op
from sqlalchemy import and_, Column, ForeignKey, Integer
from sqlalchemy.ext.declarative import declarative_base

from superset import db

# revision identifiers, used by Alembic.
revision = "190188938582"
down_revision = "d6ffdf31bdd4"

Base = declarative_base()


class DashboardSlices(Base):
    __tablename__ = "dashboard_slices"
    id = Column(Integer, primary_key=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"))
    slice_id = Column(Integer, ForeignKey("slices.id"))


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    # find dup records in dashboard_slices tbl
    dup_records = (
        session.query(
            DashboardSlices.dashboard_id,
            DashboardSlices.slice_id,
            db.func.count(DashboardSlices.id),
        )
        .group_by(DashboardSlices.dashboard_id, DashboardSlices.slice_id)
        .having(db.func.count(DashboardSlices.id) > 1)
        .all()
    )

    # remove dup entries
    for record in dup_records:
        print(
            "remove duplicates from dashboard {} slice {}".format(
                record.dashboard_id, record.slice_id
            )
        )

        ids = [
            item.id
            for item in session.query(DashboardSlices.id)
            .filter(
                and_(
                    DashboardSlices.slice_id == record.slice_id,
                    DashboardSlices.dashboard_id == record.dashboard_id,
                )
            )
            .offset(1)
        ]
        session.query(DashboardSlices).filter(DashboardSlices.id.in_(ids)).delete(
            synchronize_session=False
        )

    # add unique constraint
    try:
        with op.batch_alter_table("dashboard_slices") as batch_op:
            batch_op.create_unique_constraint(
                "uq_dashboard_slice", ["dashboard_id", "slice_id"]
            )
    except Exception as ex:
        logging.exception(ex)


def downgrade():
    try:
        with op.batch_alter_table("dashboard_slices") as batch_op:
            batch_op.drop_constraint("uq_dashboard_slice", type_="unique")
    except Exception as ex:
        logging.exception(ex)
