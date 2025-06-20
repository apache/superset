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
"""add embedded_charts table

Revision ID: 67dd9e3429b2
Revises: f1edd4a4d4f2
Create Date: 2025-05-14 03:40:13.406669

"""

import sqlalchemy as sa
import sqlalchemy_utils
from alembic import op

# revision identifiers, used by Alembic.
revision = "67dd9e3429b2"
down_revision = "f1edd4a4d4f2"


def upgrade():
    op.create_table(
        "embedded_charts",
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column(
            "uuid", sqlalchemy_utils.types.uuid.UUIDType(binary=True), nullable=False
        ),
        sa.Column("allow_domain_list", sa.Text(), nullable=True),
        sa.Column("slice_id", sa.Integer(), nullable=False),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["changed_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["created_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["slice_id"], ["slices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("uuid"),
    )


def downgrade():
    op.drop_table("embedded_charts")
