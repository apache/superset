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
"""Update charts with old time comparison controls

Revision ID: f84fde59123a
Revises: 9621c6d56ffb
Create Date: 2024-05-10 18:02:38.891060

"""

import logging
from copy import deepcopy
from datetime import datetime, timedelta
from hashlib import md5
from typing import Any

from alembic import op
from sqlalchemy import Column, Integer, or_, String, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.migrations.shared.utils import paginated_update
from superset.utils import json
from superset.utils.date_parser import get_since_until

# revision identifiers, used by Alembic.
revision = "f84fde59123a"
down_revision = "9621c6d56ffb"

logger = logging.getLogger(__name__)
Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    params = Column(Text)
    viz_type = Column(String(250))


time_map = {
    "r": "inherit",
    "y": "1 year ago",
    "m": "1 month ago",
    "w": "1 week ago",
    "c": "custom",
}


def upgrade_comparison_params(slice_params: dict[str, Any]) -> dict[str, Any]:
    params = deepcopy(slice_params)

    # Update time_comparison to time_compare
    if "time_comparison" in params:
        time_comp = params.pop("time_comparison")
        params["time_compare"] = (
            [time_map.get(time_comp, "inherit")]
            if "enable_time_comparison" in params and params["enable_time_comparison"]
            else []
        )

    if "enable_time_comparison" in params:
        del params["enable_time_comparison"]

    # Add comparison_type
    params["comparison_type"] = "values"

    # Adjust adhoc_custom
    if "adhoc_custom" in params and params["adhoc_custom"]:
        adhoc = params["adhoc_custom"][0]  # As there's always only one element
        if adhoc["comparator"] != "No filter":
            # Set start_date_offset in params, not in adhoc
            start_date_offset, _ = get_since_until(adhoc["comparator"])
            params["start_date_offset"] = start_date_offset.strftime("%Y-%m-%d")
        # delete adhoc_custom
        del params["adhoc_custom"]

    return params


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in paginated_update(
        session.query(Slice).filter(
            or_(Slice.viz_type == "pop_kpi", Slice.viz_type == "table")
        )
    ):
        try:
            params = json.loads(slc.params)
            updated_slice_params = upgrade_comparison_params(params)
            slc.params = json.dumps(updated_slice_params)
        except Exception as ex:
            session.rollback()
            logger.exception(
                f"An error occurred: Upgrading params for slice {slc.id} failed."
                f"You need to fix it before upgrading your DB."
            )
            raise Exception(f"An error occurred while upgrading slice: {ex}") from ex

    session.commit()
    session.close()


def downgrade_comparison_params(slice_params: dict[str, Any]) -> dict[str, Any]:
    params = deepcopy(slice_params)
    params["enable_time_comparison"] = False

    reverse_time_map = {
        v: k for k, v in time_map.items()
    }  # Reverse the map from the upgrade function

    # Revert time_compare to time_comparison
    if "time_compare" in params:
        time_comp = params.pop("time_compare")
        # Max one element in the time_compare list
        time_comp = time_comp[0] if time_comp else ""
        params["time_comparison"] = reverse_time_map.get(time_comp, "r")
        # If the chart was using any time compare, enable time comparison
        if time_comp:
            params["enable_time_comparison"] = True

    # Remove comparison_type
    if "comparison_type" in params:
        del params["comparison_type"]

    # Default adhoc_custom
    adhoc_custom = [
        {
            "clause": "WHERE",
            "subject": "ds",
            "operator": "TEMPORAL_RANGE",
            "comparator": "No filter",
            "expressionType": "SIMPLE",
        }
    ]

    # Handle start_date_offset and adjust adhoc_custom if necessary
    if "start_date_offset" in params:
        start_date_offset = datetime.strptime(
            params.pop("start_date_offset"), "%Y-%m-%d"
        )
        adhoc_filters = params.get("adhoc_filters", [])
        temporal_range_filter = next(
            (f for f in adhoc_filters if f["operator"] == "TEMPORAL_RANGE"), None
        )

        if temporal_range_filter:
            since, until = get_since_until(temporal_range_filter["comparator"])
            delta_days = (until - since).days
            new_until_date = start_date_offset + timedelta(days=delta_days - 1)
            comparator_str = f"{start_date_offset.strftime('%Y-%m-%d')} : {new_until_date.strftime('%Y-%m-%d')}"

            # Generate filterOptionName
            random_string = md5(comparator_str.encode("utf-8")).hexdigest()
            filter_option_name = f"filter_{random_string}"

            adhoc_custom[0] = {
                "expressionType": "SIMPLE",
                "subject": "ds",
                "operator": "TEMPORAL_RANGE",
                "comparator": comparator_str,
                "clause": "WHERE",
                "sqlExpression": None,
                "isExtra": False,
                "isNew": False,
                "datasourceWarning": False,
                "filterOptionName": filter_option_name,
            }

    params["adhoc_custom"] = adhoc_custom

    return params


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in paginated_update(
        session.query(Slice).filter(
            Slice.viz_type == "pop_kpi" or Slice.viz_type == "table"
        )
    ):
        try:
            params = json.loads(slc.params)
            updated_slice_params = downgrade_comparison_params(params)
            slc.params = json.dumps(updated_slice_params)
        except Exception as ex:
            session.rollback()
            logger.exception(
                f"An error occurred: Downgrading params for slice {slc.id} failed."
                f"You need to fix it before downgrading your DB."
            )
            raise Exception(f"An error occurred while downgrading slice: {ex}") from ex

    session.commit()
    session.close()
