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
"""add currency column support

Revision ID: 9787190b3d89
Revises: f5b5f88d8526
Create Date: 2025-11-18 14:00:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import add_columns, drop_columns

# revision identifiers, used by Alembic.
revision = "9787190b3d89"
down_revision = "f5b5f88d8526"


def upgrade():
    """Add currency column support to datasets."""
    # Add currency code column designation to tables (like main_dttm_col pattern)
    add_columns(
        "tables",
        sa.Column("currency_code_column", sa.String(250), nullable=True),
    )


def downgrade():
    """Remove currency column support."""
    drop_columns(
        "tables",
        "currency_code_column",
    )
