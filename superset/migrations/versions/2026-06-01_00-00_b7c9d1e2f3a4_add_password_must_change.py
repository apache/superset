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
"""add password_must_change to user_attribute

Revision ID: b7c9d1e2f3a4
Revises: c8d2e3f4a5b6, f7a1c93e0b21
Create Date: 2026-06-01 00:00:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import add_columns, drop_columns

# revision identifiers, used by Alembic.
revision = "b7c9d1e2f3a4"
down_revision = ("c8d2e3f4a5b6", "f7a1c93e0b21")


def upgrade() -> None:
    add_columns(
        "user_attribute",
        sa.Column(
            "password_must_change",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    drop_columns("user_attribute", "password_must_change")
