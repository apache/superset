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
"""Added always_filter_main_dttm to datasource

Revision ID: 317970b4400c
Revises: ec54aca4c8a2
Create Date: 2023-09-06 13:18:59.597259

"""

# revision identifiers, used by Alembic.
revision = "317970b4400c"
down_revision = "ec54aca4c8a2"

import sqlalchemy as sa
from alembic import op
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session

from superset import db
from superset.migrations.shared.utils import paginated_update, table_has_column

Base = declarative_base()


class SqlaTable(Base):
    __tablename__ = "tables"

    id = sa.Column(sa.Integer, primary_key=True)
    always_filter_main_dttm = sa.Column(sa.Boolean())


def upgrade():
    if not table_has_column("tables", "always_filter_main_dttm"):
        op.add_column(
            "tables",
            sa.Column(
                "always_filter_main_dttm",
                sa.Boolean(),
                nullable=True,
                default=False,
                server_default=sa.false(),
            ),
        )

        bind = op.get_bind()
        session = db.Session(bind=bind)

        for table in paginated_update(session.query(SqlaTable)):
            table.always_filter_main_dttm = False


def downgrade():
    if table_has_column("tables", "always_filter_main_dttm"):
        op.drop_column("tables", "always_filter_main_dttm")
