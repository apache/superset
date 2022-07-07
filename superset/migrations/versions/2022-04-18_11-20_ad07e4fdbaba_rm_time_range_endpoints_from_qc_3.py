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
"""rm_time_range_endpoints_from_qc_3

Revision ID: ad07e4fdbaba
Revises: cecc6bf46990
Create Date: 2022-04-18 11:20:47.390901

"""

# revision identifiers, used by Alembic.
revision = "ad07e4fdbaba"
down_revision = "cecc6bf46990"

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

    query_context.get("form_data", {}).pop("time_range_endpoints", None)

    if query_context.get("queries"):
        queries = query_context["queries"]
        for query in queries:
            query.get("extras", {}).pop("time_range_endpoints", None)

    slc.query_context = json.dumps(query_context)

    return slc


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    slices_updated = 0
    for slc in (
        session.query(Slice)
        .filter(Slice.query_context.like("%time_range_endpoints%"))
        .all()
    ):
        updated_slice = upgrade_slice(slc)
        if updated_slice:
            slices_updated += 1

    print(f"slices updated with no time_range_endpoints: {slices_updated}")
    session.commit()
    session.close()


def downgrade():
    pass
