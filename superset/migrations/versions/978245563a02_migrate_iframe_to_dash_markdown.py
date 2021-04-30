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
"""Migrate iframe in dashboard to markdown component

Revision ID: 978245563a02
Revises: f2672aa8350a
Create Date: 2020-08-12 00:24:39.617899

"""
import collections
import json
import logging
import uuid
from collections import defaultdict

from alembic import op
from sqlalchemy import and_, Column, ForeignKey, Integer, String, Table, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

from superset import db

# revision identifiers, used by Alembic.
revision = "978245563a02"
down_revision = "f2672aa8350a"

Base = declarative_base()


class Slice(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    params = Column(Text)
    viz_type = Column(String(250))


dashboard_slices = Table(
    "dashboard_slices",
    Base.metadata,
    Column("id", Integer, primary_key=True),
    Column("dashboard_id", Integer, ForeignKey("dashboards.id")),
    Column("slice_id", Integer, ForeignKey("slices.id")),
)

slice_user = Table(
    "slice_user",
    Base.metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("ab_user.id")),
    Column("slice_id", Integer, ForeignKey("slices.id")),
)


class Dashboard(Base):
    __tablename__ = "dashboards"
    id = Column(Integer, primary_key=True)
    position_json = Column(Text)
    slices = relationship("Slice", secondary=dashboard_slices, backref="dashboards")


def create_new_markdown_component(chart_position, url):
    return {
        "type": "MARKDOWN",
        "id": "MARKDOWN-{}".format(uuid.uuid4().hex[:8]),
        "children": [],
        "parents": chart_position["parents"],
        "meta": {
            "width": chart_position["meta"]["width"],
            "height": chart_position["meta"]["height"],
            "code": f'<iframe src="{url}" width="100%" height="100%"></iframe>',
        },
    }


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    dash_to_migrate = defaultdict(list)
    iframe_urls = defaultdict(list)

    try:
        # find iframe viz_type and its url
        iframes = session.query(Slice).filter_by(viz_type="iframe").all()
        iframe_ids = [slc.id for slc in iframes]

        for iframe in iframes:
            iframe_params = json.loads(iframe.params or "{}")
            url = iframe_params.get("url")
            iframe_urls[iframe.id] = url

        # find iframe viz_type that used in dashboard
        dash_slc = (
            session.query(dashboard_slices)
            .filter(dashboard_slices.c.slice_id.in_(iframe_ids))
            .all()
        )
        for entry in dash_slc:
            dash_to_migrate[entry.dashboard_id].append(entry.slice_id)
        dashboard_ids = list(dash_to_migrate.keys())

        # replace iframe in dashboard metadata
        dashboards = (
            session.query(Dashboard).filter(Dashboard.id.in_(dashboard_ids)).all()
        )
        for i, dashboard in enumerate(dashboards):
            print(
                f"scanning dashboard ({i + 1}/{len(dashboards)}) dashboard: {dashboard.id} >>>>"
            )

            # remove iframe slices from dashboard
            dashboard.slices = [
                slc for slc in dashboard.slices if slc.id not in iframe_ids
            ]

            # find iframe chart position in metadata
            # and replace it with markdown component
            position_dict = json.loads(dashboard.position_json or "{}")
            keys_to_remove = []
            for key, chart_position in position_dict.items():
                if (
                    chart_position
                    and isinstance(chart_position, dict)
                    and chart_position["type"] == "CHART"
                    and chart_position["meta"]
                    and chart_position["meta"]["chartId"] in iframe_ids
                ):
                    iframe_id = chart_position["meta"]["chartId"]
                    # make new markdown component
                    markdown = create_new_markdown_component(
                        chart_position, iframe_urls[iframe_id]
                    )
                    keys_to_remove.append(key)
                    position_dict[markdown["id"]] = markdown

                    # add markdown to layout tree
                    parent_id = markdown["parents"][-1]
                    children = position_dict[parent_id]["children"]
                    children.remove(key)
                    children.append(markdown["id"])

            if keys_to_remove:
                for key_to_remove in keys_to_remove:
                    del position_dict[key_to_remove]
                dashboard.position_json = json.dumps(
                    position_dict, indent=None, separators=(",", ":"), sort_keys=True,
                )
                session.merge(dashboard)

        # remove iframe, separator and markup charts
        slices_to_remove = (
            session.query(Slice)
            .filter(Slice.viz_type.in_(["iframe", "separator", "markup"]))
            .all()
        )
        slices_ids = [slc.id for slc in slices_to_remove]

        # remove dependencies first
        session.query(dashboard_slices).filter(
            dashboard_slices.c.slice_id.in_(slices_ids)
        ).delete(synchronize_session=False)

        session.query(slice_user).filter(slice_user.c.slice_id.in_(slices_ids)).delete(
            synchronize_session=False
        )

        # remove slices
        session.query(Slice).filter(Slice.id.in_(slices_ids)).delete(
            synchronize_session=False
        )

    except Exception as ex:
        logging.exception(f"dashboard {dashboard.id} has error: {ex}")

    session.commit()
    session.close()


def downgrade():
    # note: this upgrade is irreversible.
    # this migration removed all iframe, separator, and markup type slices,
    # and Superset will not support these 3 viz_type anymore.
    pass
