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
"""add sessions_invalidated_at to user_attribute

Revision ID: f7a1c93e0b21
Revises: 33d7e0e21daa
Create Date: 2026-06-02 10:00:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import (
    add_columns,
    create_index,
    drop_columns,
    drop_index,
)

# revision identifiers, used by Alembic.
revision = "f7a1c93e0b21"
down_revision = "33d7e0e21daa"

TABLE = "user_attribute"
COLUMN = "sessions_invalidated_at"
INDEX = "ix_user_attribute_sessions_invalidated_at"


def upgrade():
    add_columns(TABLE, sa.Column(COLUMN, sa.DateTime(), nullable=True))
    create_index(TABLE, INDEX, [COLUMN])


def downgrade():
    drop_index(TABLE, INDEX)
    drop_columns(TABLE, COLUMN)
