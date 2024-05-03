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
"""add_normalize_columns_to_sqla_model

Revision ID: 9f4a086c2676
Revises: 4448fa6deeb1
Create Date: 2023-08-14 09:38:11.897437

"""

# revision identifiers, used by Alembic.
revision = "9f4a086c2676"
down_revision = "4448fa6deeb1"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402
from superset.migrations.shared.utils import paginated_update  # noqa: E402

Base = declarative_base()


class SqlaTable(Base):
    __tablename__ = "tables"

    id = sa.Column(sa.Integer, primary_key=True)
    normalize_columns = sa.Column(sa.Boolean())


def upgrade():
    op.add_column(
        "tables",
        sa.Column(
            "normalize_columns",
            sa.Boolean(),
            nullable=True,
            default=False,
            server_default=sa.false(),
        ),
    )

    bind = op.get_bind()
    session = db.Session(bind=bind)

    for table in paginated_update(session.query(SqlaTable)):
        table.normalize_columns = True


def downgrade():
    op.drop_column("tables", "normalize_columns")
