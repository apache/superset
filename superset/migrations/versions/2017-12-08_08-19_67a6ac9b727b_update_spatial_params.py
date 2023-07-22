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
"""update_spatial_params

Revision ID: 67a6ac9b727b
Revises: 4736ec66ce19
Create Date: 2017-12-08 08:19:21.148775

"""
import json

from alembic import op
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db

# revision identifiers, used by Alembic.
revision = "67a6ac9b727b"
down_revision = "4736ec66ce19"

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    viz_type = Column(String(250))
    params = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).filter(Slice.viz_type.like("deck_%")):
        params = json.loads(slc.params)
        if params.get("latitude"):
            params["spatial"] = {
                "lonCol": params.get("longitude"),
                "latCol": params.get("latitude"),
                "type": "latlong",
            }
            del params["latitude"]
            del params["longitude"]
        slc.params = json.dumps(params)
        session.commit()
    session.close()


def downgrade():
    pass
