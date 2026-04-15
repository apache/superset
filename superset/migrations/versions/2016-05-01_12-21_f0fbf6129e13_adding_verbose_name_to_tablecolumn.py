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
"""Adding verbose_name to tablecolumn

Revision ID: f0fbf6129e13
Revises: c3a8f8611885
Create Date: 2016-05-01 12:21:18.331191

"""

# revision identifiers, used by Alembic.
revision = "f0fbf6129e13"
down_revision = "c3a8f8611885"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    op.add_column(
        "table_columns",
        sa.Column("verbose_name", sa.String(length=1024), nullable=True),
    )


def downgrade():
    op.drop_column("table_columns", "verbose_name")
