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
"""deckgl-path-width-units

Revision ID: ee179a490af9
Revises: e0f6f91c2055
Create Date: 2023-07-19 17:54:06.752360

"""

import logging

from alembic import op
from sqlalchemy import Column, Integer, or_, String, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.utils import json

# revision identifiers, used by Alembic.
revision = "ee179a490af9"
down_revision = "e0f6f91c2055"


Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    viz_type = Column(String(250))
    params = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    for slc in session.query(Slice).filter(
        or_(
            Slice.viz_type == "deck_path",
            Slice.viz_type == "deck_geojson",
            Slice.viz_type == "deck_polygon",
        )
    ):
        try:
            params = json.loads(slc.params)
            if not params.get("line_width_unit"):
                params["line_width_unit"] = "meters"
                slc.params = json.dumps(params)
        except Exception:
            logging.exception(f"Unable to parse params for slice {slc.id}")
    session.commit()
    session.close()


def downgrade():
    pass
