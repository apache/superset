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
"""hide_filter_bar_dashboard_metadata.py

Revision ID: 4fad8b8b566d
Revises: 19e978e1b9c3
Create Date: 2021-04-25 09:11:34.909313

"""

# revision identifiers, used by Alembic.
revision = "4fad8b8b566d"
down_revision = "19e978e1b9c3"

import json
from typing import Any, Dict, Iterable

import sqlalchemy as sa
from alembic import op
from sqlalchemy import Column, ForeignKey, Integer, String, Table, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

from superset import db

Base = declarative_base()

dashboard_slices = Table(
    "dashboard_slices",
    Base.metadata,
    Column("id", Integer, primary_key=True),
    Column("dashboard_id", Integer, ForeignKey("dashboards.id")),
    Column("slice_id", Integer, ForeignKey("slices.id")),
)


class Dashboard(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "dashboards"
    id = Column(Integer, primary_key=True)
    json_metadata = Column(Text)
    slices = relationship("Slice", secondary=dashboard_slices, backref="dashboards")


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    viz_type = Column(String(250))


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = (
        session.query(Dashboard)
        .outerjoin(Slice, Dashboard.slices)
        .filter(Slice.viz_type == "filter_box")
        .all()
    )

    changed_filters = 0
    for dashboard in dashboards:
        try:

            json_metadata = (
                json.loads(dashboard.json_metadata) if dashboard.json_metadata else {}
            )

            json_metadata["show_native_filters"] = False

            dashboard.json_metadata = json.dumps(
                json_metadata, sort_keys=True, indent=True
            )

        except Exception as e:
            print(f"Parsing json_metadata for dashboard {dashboard.id} failed.")
            raise e

    session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = (
        session.query(Dashboard)
        .filter(Dashboard.json_metadata.like('%"show_native_filters"%'))
        .all()
    )

    changed_filters = 0
    for dashboard in dashboards:
        try:
            json_metadata = json.loads(dashboard.json_metadata)

            del json_metadata["show_native_filters"]

            dashboard.json_metadata = json.dumps(json_metadata, sort_keys=True)

        except Exception as e:
            print(f"Parsing json_metadata for dashboard {dashboard.id} failed.")
            raise e

    session.commit()
    session.close()
