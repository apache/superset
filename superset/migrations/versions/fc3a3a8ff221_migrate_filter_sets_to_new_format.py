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
from typing import Any, Dict, List

from alembic import op
from sqlalchemy import Column, Integer, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.constants import (
    EXTRA_FORM_DATA_APPEND_KEYS,
    EXTRA_FORM_DATA_OVERRIDE_KEYS,
)

Base = declarative_base()


class Dashboard(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "dashboards"
    id = Column(Integer, primary_key=True)
    json_metadata = Column(Text)


def _update_select_filters(native_filters: List[Dict[str, Any]]) -> None:
    for native_filter in native_filters:
        filter_type = native_filter.get("filterType")
        if filter_type == "filter_select":
            control_values = native_filter.get("controlValues", {})
            value = control_values.get("defaultToFirstItem", False)
            control_values["defaultToFirstItem"] = value


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
            native_filters = json_metadata.get("native_filter_configuration", [])
            _update_select_filters(native_filters)

            # upgrade filter sets
            filter_sets = json_metadata.get("filter_sets_configuration", {})
            json_metadata["filter_sets_configuration"] = filter_sets
            for filter_set in filter_sets:
                # first migrate filters that were created prior to first item option
                _update_select_filters(filter_set.get("nativeFilters", {}).values())
                changed_filter_sets += 1
                data_mask = filter_set.get("dataMask", {})
                native_filters = data_mask.pop("nativeFilters", {})
                for filter_id, filter_obj in native_filters.items():
                    changed_filters += 1
                    data_mask[filter_id] = filter_obj

                    # upgrade append filters
                    appends = filter_obj.pop("append_form_data", {})
                    filter_obj.update(appends)

                    # upgrade override filters
                    overrides = filter_obj.pop("override_form_data", {})
                    filter_obj.update(overrides)

                    # upgrade filter state
                    current_state = filter_obj.pop("currentState", {})
                    filter_obj["filterState"] = current_state

            dashboard.json_metadata = json.dumps(json_metadata, sort_keys=True)

        except Exception as e:
            print(e)
            print(f"Parsing json_metadata for dashboard {dashboard.id} failed.")
            pass

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
                old_data_mask = filter_set.pop("dataMask", {})
                native_filters = {}
                data_mask = {"nativeFilters": native_filters}
                filter_set["dataMask"] = data_mask
                for filter_id, filter_obj in old_data_mask.items():
                    changed_filters += 1
                    native_filters[filter_id] = filter_obj
                    # downgrade filter state
                    filter_state = filter_obj.pop("filterState", {})
                    filter_obj["currentState"] = filter_state

                    # downgrade append keys
                    append_form_data = {}
                    filter_obj["append_form_data"] = append_form_data
                    for key in EXTRA_FORM_DATA_APPEND_KEYS:
                        value = filter_obj.pop(key, None)
                        if value is not None:
                            append_form_data[key] = value
                    if not append_form_data:
                        del filter_obj["append_form_data"]

                    # downgrade override keys
                    override_form_data = {}
                    filter_obj["override_form_data"] = override_form_data
                    for key in EXTRA_FORM_DATA_OVERRIDE_KEYS:
                        value = filter_obj.pop(key, None)
                        if value is not None:
                            override_form_data[key] = value
                    if not override_form_data:
                        del filter_obj["override_form_data"]
            dashboard.json_metadata = json.dumps(json_metadata, sort_keys=True)
        except Exception as e:
            print(e)
            print(f"Parsing json_metadata for dashboard {dashboard.id} failed.")
            pass

    session.commit()
    session.close()
    print(f"Updated {changed_filter_sets} filter sets with {changed_filters} filters.")
