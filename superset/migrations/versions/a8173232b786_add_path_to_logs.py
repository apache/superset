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
"""Add path to logs

Revision ID: a8173232b786
Revises: 49b5a32daba5
Create Date: 2020-11-15 16:08:24.580764

"""

# revision identifiers, used by Alembic.
revision = "a8173232b786"
down_revision = "49b5a32daba5"

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql


def upgrade():
    op.add_column("logs", sa.Column("path", sa.String(length=256), nullable=True))
    op.add_column(
        "logs", sa.Column("path_no_int", sa.String(length=256), nullable=True)
    )
    op.add_column("logs", sa.Column("ref", sa.String(length=256), nullable=True))


def downgrade():
    op.drop_column("logs", "path")
    op.drop_column("logs", "path_no_int")
    op.drop_column("logs", "ref")
