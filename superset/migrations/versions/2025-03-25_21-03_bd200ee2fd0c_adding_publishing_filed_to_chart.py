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
"""adding_publishing_field_to_chart

Revision ID: bd200ee2fd0c
Revises: 32bf93dfe2a4
Create Date: 2025-03-25 21:03:10.362333

"""

# revision identifiers, used by Alembic.
revision = "bd200ee2fd0c"
down_revision = "32bf93dfe2a4"

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column(
        "slices",
        sa.Column("published", sa.Boolean(), nullable=True, server_default=sa.false()),
    )


def downgrade():
    op.drop_column("slices", "published")
