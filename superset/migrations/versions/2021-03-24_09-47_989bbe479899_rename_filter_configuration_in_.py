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
"""rename_filter_configuration_in_dashboard_metadata.py

Revision ID: 989bbe479899
Revises: 67da9ef1ef9c
Create Date: 2021-03-24 09:47:21.569508

"""

# revision identifiers, used by Alembic.
revision = "989bbe479899"
down_revision = "67da9ef1ef9c"

from alembic import op  # noqa: E402
from sqlalchemy import Column, Integer, Text  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402
from superset.utils import json  # noqa: E402

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
        .filter(Dashboard.json_metadata.like('%"filter_configuration"%'))
        .all()
    )
    changes = 0
    for dashboard in dashboards:
        try:
            json_metadata = json.loads(dashboard.json_metadata)
            filter_configuration = json_metadata.pop("filter_configuration", None)
            if filter_configuration:
                changes += 1
                json_metadata["native_filter_configuration"] = filter_configuration
                dashboard.json_metadata = json.dumps(json_metadata, sort_keys=True)
        except Exception as e:
            print(e)
            print(f"Parsing json_metadata for dashboard {dashboard.id} failed.")
            pass

    session.commit()
    session.close()
    print(f"Updated {changes} native filter configurations.")


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = (
        session.query(Dashboard)
        .filter(Dashboard.json_metadata.like('%"native_filter_configuration"%'))
        .all()
    )
    changes = 0
    for dashboard in dashboards:
        try:
            json_metadata = json.loads(dashboard.json_metadata)
            native_filter_configuration = json_metadata.pop(
                "native_filter_configuration", None
            )
            if native_filter_configuration:
                changes += 1
                json_metadata["filter_configuration"] = native_filter_configuration
                dashboard.json_metadata = json.dumps(json_metadata, sort_keys=True)
        except Exception as e:
            print(e)
            print(f"Parsing json_metadata for dashboard {dashboard.id} failed.")
            pass

    session.commit()
    session.close()
    print(f"Updated {changes} pie chart labels.")
