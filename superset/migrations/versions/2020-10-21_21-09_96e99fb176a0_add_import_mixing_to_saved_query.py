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
"""add_import_mixing_to_saved_query

Revision ID: 96e99fb176a0
Revises: 585b0b1a7b18
Create Date: 2020-10-21 21:09:55.945956

"""

import os
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy_utils import UUIDType

from superset import db
from superset.migrations.shared.utils import assign_uuids

# revision identifiers, used by Alembic.
revision = "96e99fb176a0"
down_revision = "585b0b1a7b18"


Base = declarative_base()


class ImportMixin:
    id = sa.Column(sa.Integer, primary_key=True)
    uuid = sa.Column(UUIDType(binary=True), primary_key=False, default=uuid4)


class SavedQuery(ImportMixin, Base):
    __tablename__ = "saved_query"


default_batch_size = int(os.environ.get("BATCH_SIZE", 200))


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    # Add uuid column
    try:
        with op.batch_alter_table("saved_query") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "uuid",
                    UUIDType(binary=True),
                    primary_key=False,
                    default=uuid4,
                ),
            )
    except OperationalError:
        # Ignore column update errors so that we can run upgrade multiple times
        pass

    assign_uuids(SavedQuery, session)

    try:
        # Add uniqueness constraint
        with op.batch_alter_table("saved_query") as batch_op:
            # Batch mode is required for sqlite
            batch_op.create_unique_constraint("uq_saved_query_uuid", ["uuid"])
    except OperationalError:
        pass


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    # Remove uuid column
    with op.batch_alter_table("saved_query") as batch_op:
        batch_op.drop_constraint("uq_saved_query_uuid", type_="unique")
        batch_op.drop_column("uuid")
