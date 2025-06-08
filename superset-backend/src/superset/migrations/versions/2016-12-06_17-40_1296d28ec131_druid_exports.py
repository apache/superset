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
"""Adds params to the datasource (druid) table

Revision ID: 1296d28ec131
Revises: 6414e83d82b7
Create Date: 2016-12-06 17:40:40.389652

"""

# revision identifiers, used by Alembic.
revision = "1296d28ec131"
down_revision = "6414e83d82b7"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    op.add_column(
        "datasources", sa.Column("params", sa.String(length=1000), nullable=True)
    )


def downgrade():
    op.drop_column("datasources", "params")
