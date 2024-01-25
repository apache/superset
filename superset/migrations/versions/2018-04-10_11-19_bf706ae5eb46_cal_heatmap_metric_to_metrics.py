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
"""cal_heatmap_metric_to_metrics

Revision ID: bf706ae5eb46
Revises: f231d82b9b26
Create Date: 2018-04-10 11:19:47.621878

"""
import json

from alembic import op
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db

Base = declarative_base()

# revision identifiers, used by Alembic.
revision = "bf706ae5eb46"
down_revision = "f231d82b9b26"


class Slice(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    datasource_type = Column(String(200))
    viz_type = Column(String(200))
    slice_name = Column(String(200))
    params = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    slices = session.query(Slice).filter_by(viz_type="cal_heatmap").all()
    slice_len = len(slices)
    for i, slc in enumerate(slices):
        try:
            params = json.loads(slc.params or "{}")
            params["metrics"] = [params.get("metric")]
            del params["metric"]
            slc.params = json.dumps(params, indent=2, sort_keys=True)
            session.commit()
            print(f"Upgraded ({i}/{slice_len}): {slc.slice_name}")
        except Exception as ex:
            print(slc.slice_name + " error: " + str(ex))

    session.close()


def downgrade():
    pass
