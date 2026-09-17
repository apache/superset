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
"""Add extra column to tables and metrics

Revision ID: f120347acb39
Revises: f2672aa8350a
Create Date: 2020-08-12 10:01:43.531845

"""

# revision identifiers, used by Alembic.
revision = "f120347acb39"
down_revision = "f2672aa8350a"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    op.add_column("tables", sa.Column("extra", sa.Text(), nullable=True))
    op.add_column("sql_metrics", sa.Column("extra", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("tables", "extra")
    op.drop_column("sql_metrics", "extra")
