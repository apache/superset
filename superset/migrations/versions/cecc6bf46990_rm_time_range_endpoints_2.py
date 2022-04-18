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
"""rm_time_range_endpoints_2

Revision ID: cecc6bf46990
Revises: 9d8a8d575284
Create Date: 2022-04-14 17:21:53.996022

"""

# revision identifiers, used by Alembic.
revision = "cecc6bf46990"
down_revision = "9d8a8d575284"

import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy.ext.declarative import declarative_base

from superset import db

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"
    id = sa.Column(sa.Integer, primary_key=True)
    query_context = sa.Column(sa.Text)
    slice_name = sa.Column(sa.String(250))


def upgrade_slice(slc: Slice):
    try:
        query_context = json.loads(slc.query_context)
    except json.decoder.JSONDecodeError:
        return

    queries = query_context.get("queries")

    for query in queries:
        query.get("extras", {}).pop("time_range_endpoints", None)

    slc.query_context = json.dumps(query_context)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    for slc in session.query(Slice).filter(
        Slice.query_context.like("%time_range_endpoints%")
    ):
        upgrade_slice(slc)

    session.commit()
    session.close()


def downgrade():
    pass
