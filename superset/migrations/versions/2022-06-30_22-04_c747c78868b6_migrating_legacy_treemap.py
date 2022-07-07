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
"""Migrating legacy TreeMap

Revision ID: c747c78868b6
Revises: e786798587de
Create Date: 2022-06-30 22:04:17.686635

"""

# revision identifiers, used by Alembic.

revision = "c747c78868b6"
down_revision = "7fb8bca906d2"

from alembic import op
from sqlalchemy import and_, Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.utils.migrate_viz import get_migrate_class, MigrateVizEnum

treemap_processor = get_migrate_class[MigrateVizEnum.treemap]

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    slice_name = Column(String(250))
    viz_type = Column(String(250))
    params = Column(Text)
    query_context = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    slices = session.query(Slice).filter(
        Slice.viz_type == treemap_processor.source_viz_type
    )
    total = slices.count()
    idx = 0
    for slc in slices.yield_per(1000):
        try:
            idx += 1
            print(f"Upgrading ({idx}/{total}): {slc.slice_name}#{slc.id}")
            new_viz = treemap_processor.upgrade(slc)
            session.merge(new_viz)
        except Exception as exc:
            print(
                "Error while processing migration: '{}'\nError: {}\n".format(
                    slc.slice_name, str(exc)
                )
            )
    session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    slices = session.query(Slice).filter(
        and_(
            Slice.viz_type == treemap_processor.target_viz_type,
            Slice.params.like("%form_data_bak%"),
        )
    )
    total = slices.count()
    idx = 0
    for slc in slices.yield_per(1000):
        try:
            idx += 1
            print(f"Downgrading ({idx}/{total}): {slc.slice_name}#{slc.id}")
            new_viz = treemap_processor.downgrade(slc)
            session.merge(new_viz)
        except Exception as exc:
            print(
                "Error while processing migration: '{}'\nError: {}\n".format(
                    slc.slice_name, str(exc)
                )
            )
    session.commit()
    session.close()
