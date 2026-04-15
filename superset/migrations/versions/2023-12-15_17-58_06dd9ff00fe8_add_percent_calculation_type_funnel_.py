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
"""add_percent_calculation_type_funnel_chart

Revision ID: 06dd9ff00fe8
Revises: b7851ee5522f
Create Date: 2023-12-15 17:58:18.277951

"""

from alembic import op
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.migrations.shared.utils import paginated_update
from superset.utils import json

# revision identifiers, used by Alembic.
revision = "06dd9ff00fe8"
down_revision = "b7851ee5522f"

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    viz_type = Column(String(250))
    params = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in paginated_update(
        session.query(Slice).filter(Slice.viz_type == "funnel")
    ):
        params = json.loads(slc.params)
        percent_calculation = params.get("percent_calculation_type")
        if not percent_calculation:
            params["percent_calculation_type"] = "total"
            slc.params = json.dumps(params)
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in paginated_update(
        session.query(Slice).filter(Slice.viz_type == "funnel")
    ):
        params = json.loads(slc.params)
        percent_calculation = params.get("percent_calculation_type")
        if percent_calculation:
            del params["percent_calculation_type"]
            slc.params = json.dumps(params)
    session.close()
