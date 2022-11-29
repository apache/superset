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
"""truncate bubble chart y axis

Revision ID: 91a5a62147cf
Revises: 4ce1d9b25135
Create Date: 2022-11-29 18:58:23.646893

"""

# revision identifiers, used by Alembic.
revision = "91a5a62147cf"
down_revision = "4ce1d9b25135"

import json
import logging

import sqlalchemy as sa
from alembic import op
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db

logger = logging.getLogger(__name__)
Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    params = Column(Text)
    viz_type = Column(String(250))


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    for slc in session.query(Slice).filter(Slice.viz_type == "bubble").all():
        try:
            params = json.loads(slc.params)
            y_axis_bounds = params.get("y_axis_bounds", [None, None])
            truncate_y_axis = params.get("truncateYAxis", False)

            if y_axis_bounds == [None, None] and not truncate_y_axis:
                params["truncateYAxis"] = True

            slc.params = json.dumps(params)

        except Exception as ex:
            logger.error(f"Error updating model {str(ex)}")

    session.commit()
    session.close()


def downgrade():
    # as users might have updated y axis truncation manually, we don't set truncation back to False
    pass
