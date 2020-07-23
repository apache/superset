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
"""Reduce position_json size by remove extra space and component id prefix

Revision ID: 7fcdcde0761c
Revises: c18bd4186f15
Create Date: 2018-08-01 11:47:02.233971

"""

# revision identifiers, used by Alembic.
import json
import re

import sqlalchemy as sa
from alembic import op
from sqlalchemy.ext.declarative import declarative_base

from superset import db

revision = "7fcdcde0761c"
down_revision = "c18bd4186f15"

Base = declarative_base()


class Dashboard(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "dashboards"
    id = sa.Column(sa.Integer, primary_key=True)
    dashboard_title = sa.Column(sa.String(500))
    position_json = sa.Column(sa.Text)


def is_v2_dash(positions):
    return (
        isinstance(positions, dict) and positions.get("DASHBOARD_VERSION_KEY") == "v2"
    )


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = session.query(Dashboard).all()
    for i, dashboard in enumerate(dashboards):
        original_text = dashboard.position_json or ""
        position_json = json.loads(original_text or "{}")
        if is_v2_dash(position_json):
            # re-dump the json data and remove leading and trailing white spaces
            text = json.dumps(
                position_json, indent=None, separators=(",", ":"), sort_keys=True
            )
            # remove DASHBOARD_ and _TYPE prefix/suffix in all the component ids
            text = re.sub(r"DASHBOARD_(?!VERSION)", "", text)
            text = text.replace("_TYPE", "")

            dashboard.position_json = text
            print(
                "dash id:{} position_json size from {} to {}".format(
                    dashboard.id, len(original_text), len(text)
                )
            )
            session.merge(dashboard)
            session.commit()


def downgrade():
    pass
