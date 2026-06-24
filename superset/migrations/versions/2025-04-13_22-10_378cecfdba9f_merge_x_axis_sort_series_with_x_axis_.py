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
"""merge_x_axis_sort_series_with_x_axis_sort

Revision ID: 378cecfdba9f
Revises: 32bf93dfe2a4
Create Date: 2025-04-13 22:10:10.836273

"""

# revision identifiers, used by Alembic.
revision = "378cecfdba9f"
down_revision = "32bf93dfe2a4"

from alembic import op  # noqa: E402
from sqlalchemy import Column, Integer, String, Text  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402
from superset.migrations.shared.utils import paginated_update  # noqa: E402
from superset.utils import json  # noqa: E402

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    params = Column(Text)
    viz_type = Column(String(250))


timeseries_charts = [
    "echarts_timeseries_bar",
    "echarts_area",
    "echarts_timeseries_line",
    "echarts_timeseries_scatter",
    "echarts_timeseries_smooth",
    "echarts_timeseries_step",
    "echarts_timeseries",
]


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    for slc in paginated_update(
        session.query(Slice).filter(Slice.viz_type.in_(timeseries_charts))
    ):
        try:
            params = json.loads(slc.params)

            # x_axis_sort_series only appears when there are multiple metrics or groupby
            if not (
                ("metrics" in params and len(params["metrics"]) > 1)
                or ("groupby" in params and len(params["groupby"]) > 0)
            ):
                continue

            if "x_axis_sort_series" in params:
                params["x_axis_sort"] = params.pop("x_axis_sort_series")
            if "x_axis_sort_series_ascending" in params:
                params["x_axis_sort_asc"] = params.pop("x_axis_sort_series_ascending")

            slc.params = json.dumps(params, sort_keys=True)
        except Exception:  # noqa: S110
            pass

    session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in paginated_update(
        session.query(Slice).filter(Slice.viz_type.in_(timeseries_charts))
    ):
        try:
            params = json.loads(slc.params)
            # x_axis_sort_series only appears when there are multiple metrics or groupby
            if not (
                ("metrics" in params and len(params["metrics"]) > 1)
                or ("groupby" in params and len(params["groupby"]) > 0)
            ):
                continue

            if "x_axis_sort" in params:
                params["x_axis_sort_series"] = params.pop("x_axis_sort")
            if "x_axis_sort_asc" in params:
                params["x_axis_sort_series_ascending"] = params.pop("x_axis_sort_asc")

            slc.params = json.dumps(params, sort_keys=True)
        except Exception:  # noqa: S110
            pass

    session.commit()
    session.close()
