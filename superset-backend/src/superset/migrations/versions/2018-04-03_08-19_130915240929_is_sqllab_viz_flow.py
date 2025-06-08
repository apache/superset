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
"""is_sqllab_view

Revision ID: 130915240929
Revises: f231d82b9b26
Create Date: 2018-04-03 08:19:34.098789

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.ext.declarative import declarative_base

from superset import db

# revision identifiers, used by Alembic.
revision = "130915240929"
down_revision = "f231d82b9b26"

Base = declarative_base()


class Table(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "tables"
    id = sa.Column(sa.Integer, primary_key=True)
    sql = sa.Column(sa.Text)
    is_sqllab_view = sa.Column(sa.Boolean())


def upgrade():
    bind = op.get_bind()
    op.add_column(
        "tables",
        sa.Column(
            "is_sqllab_view",
            sa.Boolean(),
            nullable=True,
            default=False,
            server_default=sa.false(),
        ),
    )

    session = db.Session(bind=bind)

    # Use Slice class defined here instead of models.Slice
    for tbl in session.query(Table).all():
        if tbl.sql:
            tbl.is_sqllab_view = True

    session.commit()
    db.session.close()


def downgrade():
    op.drop_column("tables", "is_sqllab_view")
