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
"""cleanup_time_granularity

Revision ID: f9a30386bd74
Revises: b5998378c225
Create Date: 2020-03-25 10:42:11.047328

"""

# revision identifiers, used by Alembic.
revision = "f9a30386bd74"
down_revision = "b5998378c225"

from alembic import op  # noqa: E402
from sqlalchemy import Column, Integer, String, Text  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402
from superset.utils import json  # noqa: E402

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    params = Column(Text)
    viz_type = Column(String(250))


def upgrade():
    """
    Remove any erroneous time granularity fields from slices foor those visualization
    types which do not support time granularity.

    :see: https://github.com/apache/superset/pull/8674
    :see: https://github.com/apache/superset/pull/8764
    :see: https://github.com/apache/superset/pull/8800
    :see: https://github.com/apache/superset/pull/8825
    """

    bind = op.get_bind()
    session = db.Session(bind=bind)

    # Visualization types which support time granularity (hence negate).
    viz_types = [
        "area",
        "bar",
        "big_number",
        "compare",
        "dual_line",
        "line",
        "pivot_table",
        "table",
        "time_pivot",
        "time_table",
    ]

    # Erroneous time granularity fields for either Druid NoSQL or SQL slices which do
    # not support time granularity.
    erroneous = ["granularity", "time_grain_sqla"]

    for slc in session.query(Slice).filter(Slice.viz_type.notin_(viz_types)).all():
        try:
            params = json.loads(slc.params)

            if any(field in params for field in erroneous):
                for field in erroneous:
                    if field in params:
                        del params[field]

                slc.params = json.dumps(params, sort_keys=True)
        except Exception:  # noqa: S110
            pass

    session.commit()
    session.close()


def downgrade():
    pass
