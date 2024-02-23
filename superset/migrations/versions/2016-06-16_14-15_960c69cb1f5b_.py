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
"""add dttm_format related fields in table_columns

Revision ID: 960c69cb1f5b
Revises: d8bc074f7aad
Create Date: 2016-06-16 14:15:19.573183

"""

# revision identifiers, used by Alembic.
revision = "960c69cb1f5b"
down_revision = "27ae655e4247"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column(
        "table_columns",
        sa.Column("python_date_format", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "table_columns",
        sa.Column("database_expression", sa.String(length=255), nullable=True),
    )


def downgrade():
    op.drop_column("table_columns", "python_date_format")
    op.drop_column("table_columns", "database_expression")
