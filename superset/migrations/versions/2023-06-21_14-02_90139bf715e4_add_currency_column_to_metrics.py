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
"""add_currency_column_to_metrics

Revision ID: 90139bf715e4
Revises: 83e1abbe777f
Create Date: 2023-06-21 14:02:08.200955

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import add_columns, drop_columns

# revision identifiers, used by Alembic.
revision = "90139bf715e4"
down_revision = "83e1abbe777f"


def upgrade():
    add_columns("metrics", sa.Column("currency", sa.String(128), nullable=True))
    add_columns("sql_metrics", sa.Column("currency", sa.String(128), nullable=True))


def downgrade():
    drop_columns("sql_metrics", "currency")
    drop_columns("metrics", "currency")
