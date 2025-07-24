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
"""add hide_left_bar to tabstate

Revision ID: 67da9ef1ef9c
Revises: 1412ec1e5a7b
Create Date: 2021-02-22 11:22:10.156942

"""

# revision identifiers, used by Alembic.
revision = "67da9ef1ef9c"
down_revision = "1412ec1e5a7b"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402
from sqlalchemy.sql import expression  # noqa: E402


def upgrade():
    with op.batch_alter_table("tab_state") as batch_op:
        batch_op.add_column(
            sa.Column(
                "hide_left_bar",
                sa.Boolean(),
                nullable=False,
                server_default=expression.false(),
            )
        )


def downgrade():
    with op.batch_alter_table("tab_state") as batch_op:
        batch_op.drop_column("hide_left_bar")
