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
Revises: 134cea61c5e7
Create Date: 2021-04-12 12:38:03.913514

"""

# revision identifiers, used by Alembic.
revision = "fc3a3a8ff221"
down_revision = "134cea61c5e7"

import json

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
            filter_sets = json_metadata.get("filter_sets_configuration", {})
            json_metadata["filter_sets_configuration"] = filter_sets
            for filter_set in filter_sets:
                changed_filter_sets += 1
                data_mask = filter_set.get("dataMask", {})
                native_filters = data_mask.pop("nativeFilters", {})
                for filter_id, filter_obj in native_filters.items():
                    changed_filters += 1
                    current_state = filter_obj.pop("currentState", {})
                    filter_obj["filterState"] = current_state
                    data_mask[filter_id] = filter_obj
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
                    filter_state = filter_obj.pop("filterState", {})
                    filter_obj["currentState"] = filter_state
                    native_filters[filter_id] = filter_obj
            dashboard.json_metadata = json.dumps(json_metadata, sort_keys=True)
        except Exception as e:
            print(e)
            print(f"Parsing json_metadata for dashboard {dashboard.id} failed.")
            pass

    session.commit()
    session.close()
    print(f"Updated {changed_filter_sets} filter sets with {changed_filters} filters.")
