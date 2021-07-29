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
"""Migrate pivottable from v1 to v2

Revision ID: 9ed569cf4ba9
Revises: ae1ed299413b
Create Date: 2021-07-27 15:20:38.942341

"""

# revision identifiers, used by Alembic.
revision = "9ed569cf4ba9"
down_revision = "ae1ed299413b"

import os
from pathlib import Path

from alembic import op
from sqlalchemy import Column, Integer, Text
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.migrations.shared.migrate_viz import MigratePivotTable
from superset.config import DATA_DIR

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    slice_name = Column(Text)
    viz_type = Column(Text)
    params = Column(Text)
    uuid = Column(Text)


os.makedirs(os.path.join(DATA_DIR, "migrate_viz_pivottable"), exist_ok=True)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    try:
        slices = session.query(Slice).filter(Slice.viz_type == "pivot_table")
        total = slices.count()
        idx = 0
        for slc in slices.yield_per(100):
            idx += 1
            print(f"Upgrading ({idx}/{total}): {slc.slice_name}#{slc.id}")
            with open(
                os.path.join(DATA_DIR, "migrate_viz_pivottable", str(slc.uuid)),
                "w",
                encoding="utf-8",
            ) as f:
                f.write(slc.params)

            new_params = MigratePivotTable(slc.params).migrate()
            slc.params = new_params
            slc.viz_type = "pivot_table_v2"
            session.commit()
    except OperationalError:
        pass

    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    pathlist = Path(os.path.join(DATA_DIR, "migrate_viz_pivottable")).rglob("*")
    for path in pathlist:
        uuid = path.name
        slc = session.query(Slice).filter(Slice.uuid == uuid).one_or_none()
        if slc:
            with open(path, "r", encoding="utf-8") as f:
                params = f.read()
                slc.params = params
                slc.viz_type = "pivot_table"
                session.commit()
    session.close()
