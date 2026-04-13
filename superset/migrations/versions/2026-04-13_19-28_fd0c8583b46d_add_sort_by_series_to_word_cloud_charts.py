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
"""add sort_by_series to word_cloud charts

Revision ID: fd0c8583b46d
Revises: ce6bd21901ab
Create Date: 2026-04-13 19:28:19.021839

"""

from alembic import op
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.migrations.shared.utils import paginated_update
from superset.utils import json

# revision identifiers, used by Alembic.
revision = "fd0c8583b46d"
down_revision = "ce6bd21901ab"

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    viz_type = Column(String(250))
    params = Column(Text)


def upgrade_params(params: dict) -> dict:
    if "sort_by_series" not in params:
        params["sort_by_series"] = True
    return params


def downgrade_params(params: dict) -> dict:
    params.pop("sort_by_series", None)
    return params


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in paginated_update(
        session.query(Slice).filter(Slice.viz_type == "word_cloud")
    ):
        params = json.loads(slc.params or "{}")
        slc.params = json.dumps(upgrade_params(params))
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in paginated_update(
        session.query(Slice).filter(Slice.viz_type == "word_cloud")
    ):
        params = json.loads(slc.params or "{}")
        slc.params = json.dumps(downgrade_params(params))
    session.close()
