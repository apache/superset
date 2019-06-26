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
"""Add Parent ids in dashboard layout metadata

Revision ID: 80aa3f04bc82
Revises: 45e7da7cfeba
Create Date: 2019-04-09 16:27:03.392872

"""
import json
import logging

from alembic import op
from sqlalchemy import Column, Integer, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from alembic import op
import sqlalchemy as sa

from superset import db

# revision identifiers, used by Alembic.
revision = "80aa3f04bc82"
down_revision = "45e7da7cfeba"

Base = declarative_base()


class Dashboard(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "dashboards"
    id = Column(Integer, primary_key=True)
    position_json = Column(Text)


def add_parent_ids(node, layout):
    if node:
        current_id = node.get("id")
        parents = list(node.get("parents") or [])
        child_ids = node.get("children")

        if child_ids and len(child_ids) > 0:
            parents.append(current_id)
            for child_id in child_ids:
                child_node = layout.get(child_id)
                child_node["parents"] = parents
                add_parent_ids(child_node, layout)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = session.query(Dashboard).all()
    for i, dashboard in enumerate(dashboards):
        print(
            "adding parents for dashboard layout, id = {} ({}/{}) >>>>".format(
                dashboard.id, i + 1, len(dashboards)
            )
        )
        try:
            layout = json.loads(dashboard.position_json or "{}")
            if layout and layout["ROOT_ID"]:
                add_parent_ids(layout["ROOT_ID"], layout)

            dashboard.position_json = json.dumps(
                layout, indent=None, separators=(",", ":"), sort_keys=True
            )
            session.merge(dashboard)
        except Exception as e:
            logging.exception(e)

    session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = session.query(Dashboard).all()
    for i, dashboard in enumerate(dashboards):
        print(
            "remove parents from dashboard layout, id = {} ({}/{}) >>>>".format(
                dashboard.id, i + 1, len(dashboards)
            )
        )
        try:
            layout = json.loads(dashboard.position_json or "{}")
            for key, item in layout.items():
                if not isinstance(item, dict):
                    continue
                item.pop("parents", None)
                layout[key] = item

            dashboard.position_json = json.dumps(
                layout, indent=None, separators=(",", ":"), sort_keys=True
            )
            session.merge(dashboard)
        except Exception as e:
            logging.exception(e)

    session.commit()
    session.close()
