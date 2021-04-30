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
"""add missing uuid column

Revision ID: c501b7c653a3
Revises: 070c043f2fdb
Create Date: 2021-02-18 09:13:00.028317

"""

# revision identifiers, used by Alembic.
revision = "c501b7c653a3"
down_revision = "070c043f2fdb"

import logging
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.orm import load_only
from sqlalchemy_utils import UUIDType

from superset import db
from superset.migrations.versions.b56500de1855_add_uuid_column_to_import_mixin import (
    add_uuids,
    models,
    update_dashboards,
)


def has_uuid_column(table_name, bind):
    inspector = Inspector.from_engine(bind)
    columns = {column["name"] for column in inspector.get_columns(table_name)}
    has_uuid_column = "uuid" in columns
    if has_uuid_column:
        logging.info("Table %s already has uuid column, skipping...", table_name)
    else:
        logging.info("Table %s doesn't have uuid column, adding...", table_name)
    return has_uuid_column


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for table_name, model in models.items():
        # this script adds missing uuid columns
        if has_uuid_column(table_name, bind):
            continue

        with op.batch_alter_table(table_name) as batch_op:
            batch_op.add_column(
                sa.Column(
                    "uuid", UUIDType(binary=True), primary_key=False, default=uuid4,
                ),
            )
        add_uuids(model, table_name, session)

        # add uniqueness constraint
        with op.batch_alter_table(table_name) as batch_op:
            # batch mode is required for sqllite
            batch_op.create_unique_constraint(f"uq_{table_name}_uuid", ["uuid"])

    # add UUID to Dashboard.position_json; this function is idempotent
    # so we can call it for all objects
    slice_uuid_map = {
        slc.id: slc.uuid
        for slc in session.query(models["slices"])
        .options(load_only("id", "uuid"))
        .all()
    }
    update_dashboards(session, slice_uuid_map)


def downgrade() -> None:
    """
    This script fixes b56500de1855_add_uuid_column_to_import_mixin.py by adding any
    uuid columns that might have been skipped. There's no downgrade.
    """
    pass
