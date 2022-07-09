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
"""better_filters

Revision ID: fb13d49b72f9
Revises: 6c7537a6004a
Create Date: 2018-12-11 22:03:21.612516

"""
import json
import logging

from alembic import op
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db

# revision identifiers, used by Alembic.
revision = "fb13d49b72f9"
down_revision = "de021a1ca60d"

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    params = Column(Text)
    viz_type = Column(String(250))
    slice_name = Column(String(250))


def upgrade_slice(slc):
    params = json.loads(slc.params)
    logging.info(f"Upgrading {slc.slice_name}")
    cols = params.get("groupby")
    metric = params.get("metric")
    if cols:
        flts = [
            {
                "column": col,
                "metric": metric,
                "asc": False,
                "clearable": True,
                "multiple": True,
            }
            for col in cols
        ]
        params["filter_configs"] = flts
        if "groupby" in params:
            del params["groupby"]
        if "metric" in params:
            del params["metric"]
        slc.params = json.dumps(params, sort_keys=True)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    filter_box_slices = session.query(Slice).filter_by(viz_type="filter_box")
    for slc in filter_box_slices.all():
        try:
            upgrade_slice(slc)
        except Exception as ex:
            logging.exception(e)

    session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    filter_box_slices = session.query(Slice).filter_by(viz_type="filter_box")
    for slc in filter_box_slices.all():
        try:
            params = json.loads(slc.params)
            logging.info(f"Downgrading {slc.slice_name}")
            flts = params.get("filter_configs")
            if not flts:
                continue
            params["metric"] = flts[0].get("metric")
            params["groupby"] = [o.get("column") for o in flts]
            slc.params = json.dumps(params, sort_keys=True)
        except Exception as ex:
            logging.exception(ex)

    session.commit()
    session.close()
