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
"""Add new field 'is_restricted' to SqlMetric and DruidMetric

Revision ID: d8bc074f7aad
Revises: 1226819ee0e3
Create Date: 2016-06-07 12:33:25.756640

"""

# revision identifiers, used by Alembic.
revision = "d8bc074f7aad"
down_revision = "1226819ee0e3"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402
from sqlalchemy import Boolean, Column, Integer  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402

Base = declarative_base()


class DruidMetric(Base):
    """Declarative class used to do query in upgrade"""

    __tablename__ = "metrics"
    id = Column(Integer, primary_key=True)
    is_restricted = Column(Boolean, default=False, nullable=True)


class SqlMetric(Base):
    """Declarative class used to do query in upgrade"""

    __tablename__ = "sql_metrics"
    id = Column(Integer, primary_key=True)
    is_restricted = Column(Boolean, default=False, nullable=True)


def upgrade():
    op.add_column("metrics", sa.Column("is_restricted", sa.Boolean(), nullable=True))
    op.add_column(
        "sql_metrics", sa.Column("is_restricted", sa.Boolean(), nullable=True)
    )

    bind = op.get_bind()
    session = db.Session(bind=bind)

    # don't use models.DruidMetric
    # because it assumes the context is consistent with the application
    for obj in session.query(DruidMetric).all():
        obj.is_restricted = False

    for obj in session.query(SqlMetric).all():
        obj.is_restricted = False

    session.commit()
    session.close()


def downgrade():
    with op.batch_alter_table("sql_metrics", schema=None) as batch_op:
        batch_op.drop_column("is_restricted")

    with op.batch_alter_table("metrics", schema=None) as batch_op:
        batch_op.drop_column("is_restricted")
