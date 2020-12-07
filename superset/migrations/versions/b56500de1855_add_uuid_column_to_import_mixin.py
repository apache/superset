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
import os
import time
from json.decoder import JSONDecodeError
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.mysql.base import MySQLDialect
from sqlalchemy.dialects.postgresql.base import PGDialect
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import load_only
from sqlalchemy_utils import UUIDType

from superset import db
from superset.utils import core as utils

# revision identifiers, used by Alembic.
revision = "b56500de1855"
down_revision = "18532d70ab98"


Base = declarative_base()


class ImportMixin:
    id = sa.Column(sa.Integer, primary_key=True)
    uuid = sa.Column(UUIDType(binary=True), primary_key=False, default=uuid4)


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

default_batch_size = int(os.environ.get("BATCH_SIZE", 200))

# Add uuids directly using built-in SQL uuid function
add_uuids_by_dialect = {
    MySQLDialect: """UPDATE %s SET uuid = UNHEX(REPLACE(uuid(), "-", ""));""",
    PGDialect: """UPDATE %s SET uuid = uuid_in(md5(random()::text || clock_timestamp()::text)::cstring);""",
}


def add_uuids(model, table_name, session, batch_size=default_batch_size):
    """Populate columns with pre-computed uuids"""
    bind = op.get_bind()
    objects_query = session.query(model)
    count = objects_query.count()

    # silently skip if the table is empty (suitable for db initialization)
    if count == 0:
        return

    print(f"\nAdding uuids for `{table_name}`...")
    start_time = time.time()

    # Use dialect specific native SQL queries if possible
    for dialect, sql in add_uuids_by_dialect.items():
        if isinstance(bind.dialect, dialect):
            op.execute(sql % table_name)
            print(f"Done. Assigned {count} uuids in {time.time() - start_time:.3f}s.")
            return

    # Othwewise Use Python uuid function
    start = 0
    while start < count:
        end = min(start + batch_size, count)
        for obj, uuid in map(lambda obj: (obj, uuid4()), objects_query[start:end]):
            obj.uuid = uuid
            session.merge(obj)
        session.commit()
        if start + batch_size < count:
            print(f"  uuid assigned to {end} out of {count}\r", end="")
        start += batch_size

    print(f"Done. Assigned {count} uuids in {time.time() - start_time:.3f}s.")


def update_position_json(dashboard, session, uuid_map):
    try:
        layout = json.loads(dashboard.position_json or "{}")
    except JSONDecodeError:
        layout = {}

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


def update_dashboards(session, uuid_map):
    message = (
        "Updating dasboard position json with slice uuid.."
        if uuid_map
        else "Cleaning up slice uuid from dashboard position json.."
    )
    print(f"\n{message}\r", end="")

    query = session.query(models["dashboards"])
    dashboard_count = query.count()
    for i, dashboard in enumerate(query.all()):
        update_position_json(dashboard, session, uuid_map)
        if i and i % default_batch_size == 0:
            session.commit()
        print(f"{message} {i+1}/{dashboard_count}\r", end="")

    session.commit()
    # Extra whitespace to override very long numbers, e.g. 99999/99999.
    print(f"{message} Done.      \n")


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for table_name, model in models.items():
        try:
            with op.batch_alter_table(table_name) as batch_op:
                batch_op.add_column(
                    sa.Column(
                        "uuid", UUIDType(binary=True), primary_key=False, default=uuid4,
                    ),
                )
        except OperationalError:
            # ignore collumn update errors so that we can run upgrade multiple times
            pass

        add_uuids(model, table_name, session)

        try:
            # add uniqueness constraint
            with op.batch_alter_table(table_name) as batch_op:
                # batch mode is required for sqllite
                batch_op.create_unique_constraint(f"uq_{table_name}_uuid", ["uuid"])
        except OperationalError:
            pass

    # add UUID to Dashboard.position_json
    slice_uuid_map = {
        slc.id: slc.uuid
        for slc in session.query(models["slices"])
        .options(load_only("id", "uuid"))
        .all()
    }
    update_dashboards(session, slice_uuid_map)


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    # remove uuid from position_json
    update_dashboards(session, {})

    # remove uuid column
    for table_name, model in models.items():
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.drop_constraint(f"uq_{table_name}_uuid", type_="unique")
            batch_op.drop_column("uuid")
