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
"""Time grain SQLA

Revision ID: c5756bec8b47
Revises: e502db2af7be
Create Date: 2018-06-04 11:12:59.878742

"""

# revision identifiers, used by Alembic.
revision = "c5756bec8b47"
down_revision = "e502db2af7be"

import json

from alembic import op
from sqlalchemy import Column, Integer, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    params = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).all():
        try:
            params = json.loads(slc.params)

            if params.get("time_grain_sqla") == "Time Column":
                params["time_grain_sqla"] = None
                slc.params = json.dumps(params, sort_keys=True)
        except Exception:
            pass

    session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).all():
        try:
            params = json.loads(slc.params)

            if params.get("time_grain_sqla") is None:
                params["time_grain_sqla"] = "Time Column"
                slc.params = json.dumps(params, sort_keys=True)
        except Exception:
            pass

    session.commit()
    session.close()
