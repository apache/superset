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
"""add is_template flags for template dashboards

Revision ID: aaca38be72f2
Revises: a9c01ec10479
Create Date: 2025-12-16 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "aaca38be72f2"
down_revision = "a9c01ec10479"


def upgrade():
    # Add is_template_chart to slices (charts)
    with op.batch_alter_table("slices") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_template_chart",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )

    # Add is_template_dataset to tables (datasets)
    with op.batch_alter_table("tables") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_template_dataset",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )


def downgrade():
    with op.batch_alter_table("tables") as batch_op:
        batch_op.drop_column("is_template_dataset")

    with op.batch_alter_table("slices") as batch_op:
        batch_op.drop_column("is_template_chart")
