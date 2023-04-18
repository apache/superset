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
"""remove_show_native_filters

Revision ID: c0a3ea245b61
Revises: f3c2d8ec8595
Create Date: 2023-02-28 14:46:59.597847

"""

# revision identifiers, used by Alembic.
revision = "c0a3ea245b61"
down_revision = "f3c2d8ec8595"

import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy.ext.declarative import declarative_base

from superset import db

Base = declarative_base()


class Dashboard(Base):
    __tablename__ = "dashboards"

    id = sa.Column(sa.Integer, primary_key=True)
    json_metadata = sa.Column(sa.Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for dashboard in session.query(Dashboard).all():
        try:
            json_metadata = json.loads(dashboard.json_metadata)

            if "show_native_filters" in json_metadata:
                del json_metadata["show_native_filters"]
                dashboard.json_metadata = json.dumps(json_metadata)
        except Exception:  # pylint: disable=broad-except
            pass

    session.commit()
    session.close()


def downgrade():
    pass
