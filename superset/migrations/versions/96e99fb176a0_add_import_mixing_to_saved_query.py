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
Revises: af30ca79208f
Create Date: 2020-10-21 21:09:55.945956

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
revision = "96e99fb176a0"
down_revision = "af30ca79208f"


Base = declarative_base()


class ImportMixin:
    id = sa.Column(sa.Integer, primary_key=True)
    uuid = sa.Column(UUIDType(binary=True), primary_key=False, default=uuid4)


class SavedQuery(Base, ImportMixin):
    __tablename__ = "saved_query"


default_batch_size = int(os.environ.get("BATCH_SIZE", 200))

# Add uuids directly using built-in SQL uuid function
add_uuids_by_dialect = {
    MySQLDialect: """UPDATE saved_query SET uuid = UNHEX(REPLACE(uuid(), "-", ""));""",
    PGDialect: """UPDATE saved_query SET uuid = uuid_in(md5(random()::text || clock_timestamp()::text)::cstring);""",
}


def add_uuids(session, batch_size=default_batch_size):
    """Populate columns with pre-computed uuids"""
    bind = op.get_bind()
    objects_query = session.query(SavedQuery)
    count = objects_query.count()

    # silently skip if the table is empty (suitable for db initialization)
    if count == 0:
        return

    print(f"\nAdding uuids for `saved_query`...")
    start_time = time.time()

    # Use dialect specific native SQL queries if possible
    for dialect, sql in add_uuids_by_dialect.items():
        if isinstance(bind.dialect, dialect):
            op.execute(sql)
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


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    # add uuid column
    try:
        with op.batch_alter_table("saved_query") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "uuid", UUIDType(binary=True), primary_key=False, default=uuid4,
                ),
            )
    except OperationalError:
        # ignore collumn update errors so that we can run upgrade multiple times
        pass

    add_uuids(session)

    try:
        # add uniqueness constraint
        with op.batch_alter_table("saved_query") as batch_op:
            # batch mode is required for sqllite
            batch_op.create_unique_constraint("uq_saved_query_uuid", ["uuid"])
    except OperationalError:
        pass


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    # remove uuid column
    with op.batch_alter_table("saved_query") as batch_op:
        batch_op.drop_constraint("uq_saved_query_uuid", type_="unique")
        batch_op.drop_column("uuid")
