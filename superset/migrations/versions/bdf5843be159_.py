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
"""Remove show_native_filters and show_native_filters from
json_metadata when feature is not enabled

Revision ID: bdf5843be159
Revises: 453530256cea
Create Date: 2021-06-15 23:38:00.497753

"""
import json

from alembic import op
from sqlalchemy import and_, Column, Integer, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db, is_feature_enabled


# revision identifiers, used by Alembic.
revision = 'bdf5843be159'
down_revision = '453530256cea'

from alembic import op
import sqlalchemy as sa

Base = declarative_base()

class Dashboard(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "dashboards"
    id = Column(Integer, primary_key=True)
    json_metadata = Column(Text)


def upgrade():
    if is_feature_enabled("DASHBOARD_NATIVE_FILTERS"):
        print(f"DASHBOARD_NATIVE_FILTERS feature is enabled. skip.")
        return

    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = session.query(Dashboard).filter(or_(
        Dashboard.json_metadata.like('%"show_native_filters"%'),
        Dashboard.json_metadata.like('%"native_filter_configuration"%'),
    )).all()
    for i, dashboard in enumerate(dashboards):
        print(
            f"scanning dashboard ({i + 1}/{len(dashboards)}) dashboard: {dashboard.id} >>>>"
        )
        try:
            json_metadata = json.loads(dashboard.json_metadata or "{}")
            json_metadata.pop("show_native_filters", None)
            json_metadata.pop("native_filter_configuration", None)
            dashboard.json_metadata = json.dumps(json_metadata, sort_keys=True)

        except Exception as e:
            print(f"Parsing json_metadata for dashboard {dashboard.id} failed: {e}")
            pass

    session.commit()
    session.close()

def downgrade():
    pass
