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
"""add_owners_dataset_model

Revision ID: 89f17d951737
Revises: 2ed890b36b94
Create Date: 2022-03-31 22:22:43.831122

"""

# revision identifiers, used by Alembic.
revision = "89f17d951737"
down_revision = "2ed890b36b94"

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


def upgrade():
    op.create_table(
        "sl_dataset_users",
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("dataset_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["sl_datasets.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["ab_user.id"],
        ),
    )


def downgrade():
    op.drop_table("sl_dataset_users")
