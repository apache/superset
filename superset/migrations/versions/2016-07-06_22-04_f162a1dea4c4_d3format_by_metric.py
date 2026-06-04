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
"""d3format_by_metric

Revision ID: f162a1dea4c4
Revises: 960c69cb1f5b
Create Date: 2016-07-06 22:04:28.685100

"""

# revision identifiers, used by Alembic.
revision = "f162a1dea4c4"
down_revision = "960c69cb1f5b"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    op.add_column(
        "metrics", sa.Column("d3format", sa.String(length=128), nullable=True)
    )
    op.add_column(
        "sql_metrics", sa.Column("d3format", sa.String(length=128), nullable=True)
    )


def downgrade():
    op.drop_column("sql_metrics", "d3format")
    op.drop_column("metrics", "d3format")
