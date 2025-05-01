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
"""cleanup erroneous parent filter IDs

Revision ID: a23c6f8b1280
Revises: 863adcf72773
Create Date: 2023-07-19 16:48:05.571149

"""

# revision identifiers, used by Alembic.
revision = "a23c6f8b1280"
down_revision = "863adcf72773"


import logging  # noqa: E402

from alembic import op  # noqa: E402
from sqlalchemy import Column, Integer, Text  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402
from superset.utils import json  # noqa: E402

Base = declarative_base()


class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(Integer, primary_key=True)
    json_metadata = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for dashboard in session.query(Dashboard).all():
        if dashboard.json_metadata:
            updated = False

            try:
                json_metadata = json.loads(dashboard.json_metadata)

                if filters := json_metadata.get("native_filter_configuration"):
                    filter_ids = {fltr["id"] for fltr in filters}

                    for fltr in filters:
                        for parent_id in fltr.get("cascadeParentIds", [])[:]:
                            if parent_id not in filter_ids:
                                fltr["cascadeParentIds"].remove(parent_id)
                                updated = True

                if updated:
                    dashboard.json_metadata = json.dumps(json_metadata)
            except Exception:
                logging.exception(
                    f"Unable to parse JSON metadata for dashboard {dashboard.id}"
                )

    session.commit()
    session.close()


def downgrade():
    pass
