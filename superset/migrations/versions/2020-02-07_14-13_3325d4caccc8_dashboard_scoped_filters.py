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
"""empty message

Revision ID: 3325d4caccc8
Revises: e96dbf2cfef0
Create Date: 2020-02-07 14:13:51.714678

"""

# revision identifiers, used by Alembic.
import logging

from alembic import op
from sqlalchemy import Column, ForeignKey, Integer, String, Table, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

from superset import db
from superset.utils import json
from superset.utils.dashboard_filter_scopes_converter import convert_filter_scopes

revision = "3325d4caccc8"
down_revision = "e96dbf2cfef0"

Base = declarative_base()


class Slice(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    slice_name = Column(String(250))
    params = Column(Text)
    viz_type = Column(String(250))


dashboard_slices = Table(
    "dashboard_slices",
    Base.metadata,
    Column("id", Integer, primary_key=True),
    Column("dashboard_id", Integer, ForeignKey("dashboards.id")),
    Column("slice_id", Integer, ForeignKey("slices.id")),
)


class Dashboard(Base):
    __tablename__ = "dashboards"
    id = Column(Integer, primary_key=True)
    json_metadata = Column(Text)
    slices = relationship("Slice", secondary=dashboard_slices, backref="dashboards")


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = session.query(Dashboard).all()
    for i, dashboard in enumerate(dashboards):
        print(f"scanning dashboard ({i + 1}/{len(dashboards)}) >>>>")
        try:
            json_metadata = json.loads(dashboard.json_metadata or "{}")
            if "filter_scopes" in json_metadata:
                continue

            filters = [
                slice for slice in dashboard.slices if slice.viz_type == "filter_box"
            ]

            # if dashboard has filter_box
            if filters:
                filter_scopes = convert_filter_scopes(json_metadata, filters)
                json_metadata["filter_scopes"] = filter_scopes
                logging.info(
                    f"Adding filter_scopes for dashboard {dashboard.id}: {json.dumps(filter_scopes)}"
                )

            json_metadata.pop("filter_immune_slices", None)
            json_metadata.pop("filter_immune_slice_fields", None)

            if json_metadata:
                dashboard.json_metadata = json.dumps(
                    json_metadata, indent=None, separators=(",", ":"), sort_keys=True
                )
            else:
                dashboard.json_metadata = None
        except Exception as ex:
            logging.exception(f"dashboard {dashboard.id} has error: {ex}")

    session.commit()
    session.close()


def downgrade():
    pass
