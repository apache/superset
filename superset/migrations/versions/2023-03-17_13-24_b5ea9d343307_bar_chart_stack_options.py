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
"""bar_chart_stack_options

Revision ID: b5ea9d343307
Revises: d0ac08bb5b83
Create Date: 2023-03-17 13:24:54.662754

"""

# revision identifiers, used by Alembic.
revision = "b5ea9d343307"
down_revision = "d0ac08bb5b83"

from alembic import op  # noqa: E402
from sqlalchemy import Column, Integer, String, Text  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402
from superset.utils import json  # noqa: E402

Base = declarative_base()

CHART_TYPE = "%echarts_timeseries%"


class Slice(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    viz_type = Column(String(250))
    params = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    slices = session.query(Slice).filter(Slice.viz_type.like(CHART_TYPE)).all()
    for slc in slices:
        try:
            params = json.loads(slc.params)
            stack = params.get("stack", None)
            if stack:
                params["stack"] = "Stack"
            else:
                params["stack"] = None
            slc.params = json.dumps(params, sort_keys=True)
        except Exception as e:
            print(e)
            print(f"Parsing params for slice {slc.id} failed.")
            pass

    session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    slices = session.query(Slice).filter(Slice.viz_type.like(CHART_TYPE)).all()
    for slc in slices:
        try:
            params = json.loads(slc.params)
            stack = params.get("stack", None)
            if stack == "Stack" or stack == "Stream":
                params["stack"] = True
            else:
                params["stack"] = False
            slc.params = json.dumps(params, sort_keys=True)
        except Exception as e:
            print(e)
            print(f"Parsing params for slice {slc.id} failed.")
            pass

    session.commit()
    session.close()
