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
"""migrate_filter_boxes_to_native_filters

Revision ID: 214f580d09c9
Revises: a32e0c4d8646
Create Date: 2024-01-10 09:20:32.233912

"""

# revision identifiers, used by Alembic.
revision = "214f580d09c9"
down_revision = "a32e0c4d8646"

from alembic import op  # noqa: E402
from sqlalchemy import Column, ForeignKey, Integer, String, Table, Text  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402
from sqlalchemy.orm import relationship  # noqa: E402

from superset import db  # noqa: E402
from superset.migrations.shared.native_filters import migrate_dashboard  # noqa: E402
from superset.migrations.shared.utils import paginated_update  # noqa: E402

Base = declarative_base()

dashboard_slices = Table(
    "dashboard_slices",
    Base.metadata,
    Column("id", Integer, primary_key=True),
    Column("dashboard_id", Integer, ForeignKey("dashboards.id")),
    Column("slice_id", Integer, ForeignKey("slices.id")),
)


class Dashboard(Base):  # type: ignore # pylint: disable=too-few-public-methods
    __tablename__ = "dashboards"

    id = Column(Integer, primary_key=True)
    json_metadata = Column(Text)
    slices = relationship("Slice", secondary=dashboard_slices, backref="dashboards")
    position_json = Column()

    def __repr__(self) -> str:
        return f"Dashboard<{self.id}>"


class Slice(Base):  # type: ignore # pylint: disable=too-few-public-methods
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    datasource_id = Column(Integer)
    params = Column(Text)
    slice_name = Column(String(250))
    viz_type = Column(String(250))

    def __repr__(self) -> str:
        return f"Slice<{self.id}>"


def upgrade():
    session = db.Session(bind=op.get_bind())

    for dashboard in paginated_update(session.query(Dashboard)):
        migrate_dashboard(dashboard)

    # Delete the obsolete filter-box charts.
    session.query(Slice).filter(Slice.viz_type == "filter_box").delete()
    session.commit()


def downgrade():
    pass
