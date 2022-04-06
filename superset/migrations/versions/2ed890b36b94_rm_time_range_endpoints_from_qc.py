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
"""rm_time_range_endpoints_from_qc

Revision ID: 2ed890b36b94
Revises: 58df9d617f14
Create Date: 2022-03-29 18:03:48.977741

"""

# revision identifiers, used by Alembic.
revision = "2ed890b36b94"
down_revision = "58df9d617f14"

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


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    for slc in session.query(Slice).filter(
        Slice.query_context.like("%time_range_endpoints%")
    ):
        try:
            query_context = json.loads(slc.query_context)
        except json.decoder.JSONDecodeError:
            continue
        queries = query_context.get("queries")
        for query in queries:
            query.get("extras", {}).pop("time_range_endpoints", None)
        slc.queries = json.dumps(queries)

    session.commit()
    session.close()


def downgrade():
    pass
