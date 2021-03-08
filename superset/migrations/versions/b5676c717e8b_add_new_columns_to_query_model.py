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
"""add new columns to query model

Revision ID: b5676c717e8b
Revises: 070c043f2fdb
Create Date: 2021-02-18 14:22:34.727568

"""

# revision identifiers, used by Alembic.
revision = "b5676c717e8b"
down_revision = "070c043f2fdb"

from enum import Enum
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql.base import PGDialect
from superset.models.sql_lab import LimitingFactor

def upgrade():
    bind = op.get_bind()
    if isinstance(bind.dialect, PGDialect):
        limiting_factor = postgresql.ENUM("DROPDOWN", "QUERY", "NOT_LIMITED", "QUERY_AND_DROPDOWN", "UNKNOWN", name="limitingfactor")
        limiting_factor.create(bind)
    with op.batch_alter_table("query") as batch_op:
        batch_op.add_column(
            sa.Column("limiting_factor", sa.Enum("DROPDOWN", "QUERY", "NOT_LIMITED", "QUERY_AND_DROPDOWN", "UNKNOWN", name="limitingfactor"))
       )


def downgrade():
    with op.batch_alter_table("query") as batch_op:
        batch_op.drop_column("limiting_factor")
