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
"""deprecate time_range_endpoints v2

Revision ID: b0d0249074e4
Revises: 2ed890b36b94
Create Date: 2022-04-04 15:04:05.606340

"""

from alembic import op
from sqlalchemy import Column, Integer, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.utils import json

# revision identifiers, used by Alembic.
revision = "b0d0249074e4"
down_revision = "2ed890b36b94"

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    params = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).filter(Slice.params.like("%time_range_endpoints%")):
        params = json.loads(slc.params)
        params.pop("time_range_endpoints", None)
        slc.params = json.dumps(params)

    session.commit()
    session.close()


def downgrade():
    pass
