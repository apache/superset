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
"""Add access_request table to manage requests to access datastores.

Revision ID: 5e4a03ef0bf0
Revises: 41f6a59a61f2
Create Date: 2016-09-09 17:39:57.846309

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "5e4a03ef0bf0"
down_revision = "b347b202819b"


def upgrade():
    op.create_table(
        "access_request",
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("datasource_type", sa.String(length=200), nullable=True),
        sa.Column("datasource_id", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["changed_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["created_by_fk"], ["ab_user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    op.drop_table("access_request")
