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
"""add_uuid_column_to_import_mixin

Revision ID: b56500de1855
Revises: 18532d70ab98
Create Date: 2020-09-28 17:57:23.128142

"""
import json
import logging
import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy_utils import UUIDType

from superset import db
from superset.utils import core as utils

# revision identifiers, used by Alembic.
revision = "b56500de1855"
down_revision = "18532d70ab98"


Base = declarative_base()


class ImportMixin:
    id = sa.Column(sa.Integer, primary_key=True)
    uuid = sa.Column(UUIDType(binary=True), primary_key=False, default=uuid.uuid4)


table_names = [
    # Core models
    "dbs",
    "dashboards",
    "slices",
    # SQLAlchemy connectors
    "tables",
    "table_columns",
    "sql_metrics",
    # Druid connector
    "clusters",
    "datasources",
    "columns",
    "metrics",
    # Dashboard email schedules
    "dashboard_email_schedules",
    "slice_email_schedules",
]
models = {
    table_name: type(table_name, (Base, ImportMixin), {"__tablename__": table_name})
    for table_name in table_names
}

models["dashboards"].position_json = sa.Column(utils.MediumText())


def add_uuids(objects, session, batch_size=100):
    uuid_map = {}
    count = len(objects)
    for i, object_ in enumerate(objects):
        object_.uuid = uuid.uuid4()
        uuid_map[object_.id] = object_.uuid
        session.merge(object_)
        if (i + 1) % batch_size == 0:
            session.commit()
            print(f"uuid assigned to {i + 1} out of {count}")

    session.commit()
    print(f"Done! Assigned {count} uuids")

    return uuid_map


def update_position_json(dashboard, session, uuid_map):
    layout = json.loads(dashboard.position_json or "{}")
    for object_ in layout.values():
        if (
            isinstance(object_, dict)
            and object_["type"] == "CHART"
            and object_["meta"]["chartId"]
        ):
            chart_id = object_["meta"]["chartId"]
            if chart_id in uuid_map:
                object_["meta"]["uuid"] = str(uuid_map[chart_id])
            elif object_["meta"].get("uuid"):
                del object_["meta"]["uuid"]

    dashboard.position_json = json.dumps(layout, indent=4)
    session.merge(dashboard)
    session.commit()


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    uuid_maps = {}
    for table_name, model in models.items():
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.add_column(
                sa.Column(
                    "uuid",
                    UUIDType(binary=True),
                    primary_key=False,
                    default=uuid.uuid4,
                )
            )

        # populate column
        objects = session.query(model).all()
        uuid_maps[table_name] = add_uuids(objects, session)

        # add uniqueness constraint
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.create_unique_constraint(f"uq_{table_name}_uuid", ["uuid"])

    # add UUID to Dashboard.position_json
    Dashboard = models["dashboards"]
    for dashboard in session.query(Dashboard).all():
        update_position_json(dashboard, session, uuid_maps["slices"])


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    # remove uuid from position_json
    Dashboard = models["dashboards"]
    for dashboard in session.query(Dashboard).all():
        update_position_json(dashboard, session, {})

    # remove uuid column
    for table_name, model in models.items():
        with op.batch_alter_table(model) as batch_op:
            batch_op.drop_constraint(f"uq_{table_name}_uuid")
            batch_op.drop_column("uuid")
