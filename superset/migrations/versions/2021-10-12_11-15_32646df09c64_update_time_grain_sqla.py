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
"""update time grain SQLA

Revision ID: 32646df09c64
Revises: 60dc453f4e2e
Create Date: 2021-10-12 11:15:25.559532

"""

# revision identifiers, used by Alembic.
revision = "32646df09c64"
down_revision = "60dc453f4e2e"

from alembic import op  # noqa: E402
from sqlalchemy import Column, Integer, Text  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402
from superset.utils import json  # noqa: E402

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    params = Column(Text)


def migrate(mapping: dict[str, str]) -> None:
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).all():
        try:
            params = json.loads(slc.params)
            time_grain_sqla = params.get("time_grain_sqla")

            if time_grain_sqla in mapping:
                params["time_grain_sqla"] = mapping[time_grain_sqla]
                slc.params = json.dumps(params, sort_keys=True)
        except Exception:  # noqa: S110
            pass

    session.commit()
    session.close()


def upgrade():
    migrate(mapping={"PT0.5H": "PT30M", "P0.25Y": "P3M"})


def downgrade():
    migrate(mapping={"PT30M": "PT0.5H", "P3M": "P0.25Y"})
