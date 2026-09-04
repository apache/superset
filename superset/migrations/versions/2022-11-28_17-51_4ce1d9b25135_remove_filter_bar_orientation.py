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
"""remove_filter_bar_orientation

Revision ID: 4ce1d9b25135
Revises: deb4c9d4a4ef
Create Date: 2022-11-28 17:51:08.954439

"""

# revision identifiers, used by Alembic.
revision = "4ce1d9b25135"
down_revision = "deb4c9d4a4ef"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402
from superset.utils import json  # noqa: E402

Base = declarative_base()


class Dashboard(Base):
    __tablename__ = "dashboards"
    id = sa.Column(sa.Integer, primary_key=True)
    json_metadata = sa.Column(sa.Text)


def upgrade():
    pass


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = (
        session.query(Dashboard)
        .filter(Dashboard.json_metadata.like('%"filter_bar_orientation"%'))
        .all()
    )
    for dashboard in dashboards:
        json_meta = json.loads(dashboard.json_metadata)
        filter_bar_orientation = json_meta.pop("filter_bar_orientation", None)
        if filter_bar_orientation:
            dashboard.json_metadata = json.dumps(json_meta)
    session.commit()
    session.close()
