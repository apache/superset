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
"""Add column for query estimate

Revision ID: 8786d6374caa
Revises: def97f26fdfb
Create Date: 2019-09-03 23:02:15.679389

"""

# revision identifiers, used by Alembic.
revision = "8786d6374caa"
down_revision = "def97f26fdfb"

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column(
        "dbs", sa.Column("cost_estimate_enabled", sa.Boolean(), nullable=True)
    )


def downgrade():
    op.drop_column("dbs", "cost_estimate_enabled")
