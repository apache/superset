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
"""add_uuid_column_to_import_mixin.py

Revision ID: b56500de1855
Revises: e5ef6828ac4e
Create Date: 2020-09-28 17:57:23.128142

"""
import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy_utils import UUIDType

from superset import db

# revision identifiers, used by Alembic.
revision = "b56500de1855"
down_revision = "e5ef6828ac4e"


Base = declarative_base()


class ImportMixin:
    id = sa.Column(sa.Integer, primary_key=True)
    uuid = sa.Column(UUIDType(binary=False), primary_key=False, default=uuid.uuid4)


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
]
models = [
    type(table_name, (Base, ImportMixin), {"__tablename__": table_name})
    for table_name in table_names
]


def batch_commit(objects, session, batch_size=100):
    count = len(objects)
    for i, object_ in enumerate(objects):
        object_.uuid = uuid.uuid4()
        session.merge(object_)
        if (i + 1) % batch_size == 0:
            session.commit()
            print(f"uuid assigned to {i + 1} out of {count}")
    session.commit()
    print(f"Done! Assigned {count} uuids")


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for model in models:
        # add column with NULLs
        with op.batch_alter_table(model.__tablename__) as batch_op:
            batch_op.add_column(
                sa.Column(
                    "uuid",
                    UUIDType(binary=False),
                    primary_key=False,
                    default=uuid.uuid4,
                )
            )

        # populate column
        objects = session.query(model).all()
        batch_commit(objects, session)

        # add uniqueness constraint
        with op.batch_alter_table(model.__tablename__) as batch_op:
            batch_op.create_unique_constraint("uq_uuid", ["uuid"])


def downgrade():
    for model in models:
        try:
            with op.batch_alter_table(model.__tablename__) as batch_op:
                batch_op.drop_constraint("uq_uuid")
                batch_op.drop_column("uuid")
        except Exception:
            pass
