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
"""fix_form_data_string_in_query_context

Revision ID: f5b5f88d8526
Revises: a9c01ec10479
Create Date: 2025-12-16 12:00:00.000000

"""

import logging

from alembic import op
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.migrations.shared.utils import paginated_update
from superset.utils import json

# revision identifiers, used by Alembic.
revision = "f5b5f88d8526"
down_revision = "a9c01ec10479"

Base = declarative_base()
logger = logging.getLogger(__name__)

# Viz types that have migrations that were going through the bug
MIGRATED_VIZ_TYPES = [
    "treemap_v2",
    "pivot_table_v2",
    "mixed_timeseries",
    "sunburst_v2",
    "echarts_timeseries_line",
    "echarts_timeseries_smooth",
    "echarts_timeseries_step",
    "echarts_area",
    "echarts_timeseries_bar",
    "bubble_v2",
    "heatmap_v2",
    "histogram_v2",
    "sankey_v2",
]


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    viz_type = Column(String(250))
    query_context = Column(Text)


def upgrade():
    """
    Fix charts where form_data in query_context was stored as a JSON string
    instead of a dict during chart import migration.
    """
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in paginated_update(
        session.query(Slice).filter(
            Slice.viz_type.in_(MIGRATED_VIZ_TYPES),
            Slice.query_context.isnot(None),
        )
    ):
        try:
            query_context = json.loads(slc.query_context)
            form_data = query_context.get("form_data")

            # Check if form_data is a non-empty string (the bug)
            if form_data and isinstance(form_data, str):
                try:
                    query_context["form_data"] = json.loads(form_data)
                    slc.query_context = json.dumps(query_context, sort_keys=True)
                except json.JSONDecodeError:
                    logger.warning(
                        "Could not parse form_data for slice %s, skipping", slc.id
                    )
        except json.JSONDecodeError:
            logger.warning(
                "Could not parse query_context for slice %s, skipping", slc.id
            )
        except Exception:  # noqa: S110
            logger.warning("Could not update form_data for slice %s, skipping", slc.id)

    session.commit()
    session.close()


def downgrade():
    # This migration fixes data corruption, downgrade is not meaningful
    pass
