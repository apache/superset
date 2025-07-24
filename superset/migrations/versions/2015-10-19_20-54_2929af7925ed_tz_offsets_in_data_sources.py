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
"""TZ offsets in data sources

Revision ID: 2929af7925ed
Revises: 1e2841a4128
Create Date: 2015-10-19 20:54:00.565633

"""

# revision identifiers, used by Alembic.
revision = "2929af7925ed"
down_revision = "1e2841a4128"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    op.add_column("datasources", sa.Column("offset", sa.Integer(), nullable=True))
    op.add_column("tables", sa.Column("offset", sa.Integer(), nullable=True))


def downgrade():
    op.drop_column("tables", "offset")
    op.drop_column("datasources", "offset")
