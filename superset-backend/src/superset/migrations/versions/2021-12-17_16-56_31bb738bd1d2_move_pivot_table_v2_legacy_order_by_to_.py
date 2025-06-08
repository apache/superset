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
"""move_pivot_table_v2_legacy_order_by_to_timeseries_limit_metric

Revision ID: 31bb738bd1d2
Revises: fe23025b9441
Create Date: 2021-12-17 16:56:55.186285

"""

# revision identifiers, used by Alembic.
revision = "31bb738bd1d2"
down_revision = "fe23025b9441"


import logging  # noqa: E402

from alembic import op  # noqa: E402
from sqlalchemy import Column, Integer, String, Text  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402
from superset.utils import json  # noqa: E402

Base = declarative_base()

logger = logging.getLogger("alembic")


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    params = Column(Text)
    viz_type = Column(String(250))


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    slices = session.query(Slice).filter(Slice.viz_type == "pivot_table_v2").all()
    for slc in slices:
        try:
            params = json.loads(slc.params)
            legacy_order_by = params.pop("legacy_order_by", None)
            if legacy_order_by:
                params["series_limit_metric"] = legacy_order_by
            slc.params = json.dumps(params, sort_keys=True)
        except Exception:
            logger.exception(
                f"An error occurred: parsing params for slice {slc.id} failed."
                f"You need to fix it before upgrading your DB."
            )
            raise

    session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    slices = session.query(Slice).filter(Slice.viz_type == "pivot_table_v2").all()
    for slc in slices:
        try:
            params = json.loads(slc.params)
            series_limit_metric = params.pop("series_limit_metric", None)
            if series_limit_metric:
                params["legacy_order_by"] = series_limit_metric
            slc.params = json.dumps(params, sort_keys=True)
        except Exception:
            logger.exception(
                f"An error occurred: parsing params for slice {slc.id} failed. "
                "You need to fix it before downgrading your DB."
            )
            raise

    session.commit()
    session.close()
