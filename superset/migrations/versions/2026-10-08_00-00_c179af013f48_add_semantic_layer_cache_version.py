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

"""Add a transactionally rotated semantic-layer cache generation.

Revision ID: c179af013f48
Revises: 00fab727cd0a
"""

import sqlalchemy as sa

from superset.migrations.shared.utils import add_columns, drop_columns

revision: str = "c179af013f48"
down_revision: str = "00fab727cd0a"


def upgrade() -> None:
    """Initialize existing and newly inserted layers at generation zero."""
    add_columns(
        "semantic_layers",
        sa.Column("cache_version", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    """Remove only the cache generation."""
    drop_columns("semantic_layers", "cache_version")
