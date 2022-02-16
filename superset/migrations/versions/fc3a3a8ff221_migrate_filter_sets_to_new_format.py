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
"""migrate filter sets to new format

Revision ID: fc3a3a8ff221
Revises: 085f06488938
Create Date: 2021-04-12 12:38:03.913514

"""

# revision identifiers, used by Alembic.
revision = "fc3a3a8ff221"
down_revision = "085f06488938"

import json
from typing import Any, Dict, Iterable

from alembic import op
from sqlalchemy import Column, Integer, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db

Base = declarative_base()


class Dashboard(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "dashboards"
    id = Column(Integer, primary_key=True)
    json_metadata = Column(Text)


# these are copied over from `superset/constants.py` to make sure they stay unchanged
EXTRA_FORM_DATA_APPEND_KEYS = {
    "adhoc_filters",
    "filters",
    "interactive_groupby",
    "interactive_highlight",
    "interactive_drilldown",
    "custom_form_data",
}

EXTRA_FORM_DATA_OVERRIDE_REGULAR_KEYS = {
    "granularity",
    "granularity_sqla",
    "time_column",
    "time_grain",
    "time_range",
}

EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS = {
    "druid_time_origin",
    "relative_start",
    "relative_end",
    "time_grain_sqla",
    "time_range_endpoints",
}

EXTRA_FORM_DATA_OVERRIDE_KEYS = (
    EXTRA_FORM_DATA_OVERRIDE_REGULAR_KEYS | EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS
)


def upgrade_select_filters(native_filters: Iterable[Dict[str, Any]]) -> None:
    """
    Add `defaultToFirstItem` to `controlValues` of `select_filter` components
    """
    for native_filter in native_filters:
        filter_type = native_filter.get("filterType")
        if filter_type == "filter_select":
            control_values = native_filter.get("controlValues", {})
            value = control_values.get("defaultToFirstItem", False)
            control_values["defaultToFirstItem"] = value


def upgrade_filter_set(filter_set: Dict[str, Any]) -> int:
    changed_filters = 0
    upgrade_select_filters(filter_set.get("nativeFilters", {}).values())
    data_mask = filter_set.get("dataMask", {})
    native_filters = data_mask.pop("nativeFilters", {})
    for filter_id, filter_obj in native_filters.items():
        changed_filters += 1
        # move filter up one level
        data_mask[filter_id] = filter_obj

        # rename currentState to filterState
        current_state = filter_obj.pop("currentState", {})
        filter_obj["filterState"] = current_state

        # create new extraFormData field
        old_extra_form_data = filter_obj.pop("extraFormData", {})
        extra_form_data = {}
        filter_obj["extraFormData"] = extra_form_data

        # upgrade append filters
        appends = old_extra_form_data.pop("append_form_data", {})
        extra_form_data.update(appends)

        # upgrade override filters
        overrides = old_extra_form_data.pop("override_form_data", {})
        for override_key, override_value in overrides.items():
            # nested extras are also moved up to main object
            if override_key == "extras":
                for extra_key, extra_value in override_value.items():
                    extra_form_data[extra_key] = extra_value
            else:
                extra_form_data[override_key] = override_value
    return changed_filters


def downgrade_filter_set(filter_set: Dict[str, Any]) -> int:
    changed_filters = 0
    old_data_mask = filter_set.pop("dataMask", {})
    native_filters = {}
    data_mask = {"nativeFilters": native_filters}
    filter_set["dataMask"] = data_mask
    for filter_id, filter_obj in old_data_mask.items():
        changed_filters += 1
        # move filter object down one level
        native_filters[filter_id] = filter_obj

        # downgrade filter state
        filter_state = filter_obj.pop("filterState", {})
        filter_obj["currentState"] = filter_state

        old_extra_form_data = filter_obj.pop("extraFormData", {})
        extra_form_data = {}
        filter_obj["extraFormData"] = extra_form_data

        # downgrade append keys
        append_form_data = {}
        extra_form_data["append_form_data"] = append_form_data
        for key in EXTRA_FORM_DATA_APPEND_KEYS:
            value = old_extra_form_data.pop(key, None)
            if value is not None:
                append_form_data[key] = value
        if not append_form_data:
            del extra_form_data["append_form_data"]

        # downgrade override keys
        override_form_data = {}
        extra_form_data["override_form_data"] = override_form_data
        for key in EXTRA_FORM_DATA_OVERRIDE_KEYS:
            value = old_extra_form_data.pop(key, None)
            if key in EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS:
                extras = override_form_data.get("extras", {})
                extras[key] = value
            elif value is not None:
                override_form_data[key] = value
        if not override_form_data:
            del extra_form_data["override_form_data"]

    return changed_filters


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = (
        session.query(Dashboard)
        .filter(Dashboard.json_metadata.like('%"filter_sets_configuration"%'))
        .all()
    )
    changed_filter_sets, changed_filters = 0, 0
    for dashboard in dashboards:
        try:
            json_metadata = json.loads(dashboard.json_metadata)

            # upgrade native select filter metadata
            native_filters = json_metadata.get("native_filter_configuration")
            if native_filters:
                upgrade_select_filters(native_filters)

            # upgrade filter sets
            filter_sets = json_metadata["filter_sets_configuration"]
            for filter_set in filter_sets:
                changed_filter_sets += 1
                changed_filters += upgrade_filter_set(filter_set)

            dashboard.json_metadata = json.dumps(json_metadata, sort_keys=True)

        except Exception as e:
            print(f"Parsing json_metadata for dashboard {dashboard.id} failed.")
            raise e

    session.commit()
    session.close()
    print(f"Updated {changed_filter_sets} filter sets with {changed_filters} filters.")


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = (
        session.query(Dashboard)
        .filter(Dashboard.json_metadata.like('%"filter_sets_configuration"%'))
        .all()
    )
    changed_filter_sets, changed_filters = 0, 0
    for dashboard in dashboards:
        try:
            json_metadata = json.loads(dashboard.json_metadata)
            filter_sets = json_metadata.get("filter_sets_configuration", {})
            json_metadata["filter_sets_configuration"] = filter_sets
            for filter_set in filter_sets:
                changed_filter_sets += 1
                changed_filters += downgrade_filter_set(filter_set)
            dashboard.json_metadata = json.dumps(json_metadata, sort_keys=True)
        except Exception as e:
            print(f"Parsing json_metadata for dashboard {dashboard.id} failed.")
            raise e

    session.commit()
    session.close()
    print(f"Updated {changed_filter_sets} filter sets with {changed_filters} filters.")
