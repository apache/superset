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
"""add extra column to slices

Revision ID: 9d4b2e8c1f0a
Revises: 78a40c08b4be
Create Date: 2026-06-17 16:58:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import add_columns, drop_columns
from superset.utils.core import MediumText

# revision identifiers, used by Alembic.
revision = "9d4b2e8c1f0a"
down_revision = "78a40c08b4be"


def upgrade() -> None:
    """Add the nullable ``extra`` column to ``slices``."""
    add_columns(
        "slices",
        sa.Column("extra", MediumText(), nullable=True),
    )


def downgrade() -> None:
    """Drop the ``extra`` column from ``slices``."""
    drop_columns("slices", "extra")
