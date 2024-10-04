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
"""empty message

Revision ID: 4ce8df208545
Revises: 55e910a74826
Create Date: 2018-11-12 13:31:07.578090

"""

# revision identifiers, used by Alembic.
from alembic import op
from sqlalchemy import Column, Integer, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.utils import json

revision = "4ce8df208545"
down_revision = "55e910a74826"

Base = declarative_base()


class Dashboard(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "dashboards"
    id = Column(Integer, primary_key=True)
    json_metadata = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = session.query(Dashboard).all()
    for i, dashboard in enumerate(dashboards):
        print(f"scanning dashboard ({i + 1}/{len(dashboards)}) >>>>")
        if dashboard.json_metadata:
            json_metadata = json.loads(dashboard.json_metadata)
            has_update = False

            # default_filters: it may define time_range filter
            default_filters = json_metadata.get("default_filters")
            if default_filters and default_filters != "{}":
                try:
                    filters = json.loads(default_filters)
                    keys = [
                        key
                        for key, val in filters.items()
                        if val.get("__from") or val.get("__to")
                    ]
                    if len(keys):
                        for key in keys:
                            val = filters[key]
                            __from = val.pop("__from", "")
                            __to = val.pop("__to", "")
                            # if user already defined __time_range,
                            # just abandon __from and __to
                            if "__time_range" not in val:
                                val["__time_range"] = f"{__from} : {__to}"
                        json_metadata["default_filters"] = json.dumps(filters)
                        has_update = True
                except Exception:
                    pass

            # filter_immune_slice_fields:
            # key: chart id, value: field names that escape from filters
            filter_immune_slice_fields = json_metadata.get("filter_immune_slice_fields")
            if filter_immune_slice_fields:
                keys = [
                    key
                    for key, val in filter_immune_slice_fields.items()
                    if "__from" in val or "__to" in val
                ]
                if len(keys):
                    for key in keys:
                        val = filter_immune_slice_fields[key]
                        if "__from" in val:
                            val.remove("__from")
                        if "__to" in val:
                            val.remove("__to")
                        # if user already defined __time_range,
                        # just abandon __from and __to
                        if "__time_range" not in val:
                            val.append("__time_range")
                    json_metadata["filter_immune_slice_fields"] = (
                        filter_immune_slice_fields
                    )
                    has_update = True

            if has_update:
                dashboard.json_metadata = json.dumps(json_metadata)

    session.commit()
    session.close()


def downgrade():
    pass
