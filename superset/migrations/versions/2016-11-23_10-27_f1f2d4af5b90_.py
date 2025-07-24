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
"""Enable Filter Select

Revision ID: f1f2d4af5b90
Revises: e46f2d27a08e
Create Date: 2016-11-23 10:27:18.517919

"""

# revision identifiers, used by Alembic.
revision = "f1f2d4af5b90"
down_revision = "e46f2d27a08e"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    op.add_column(
        "datasources", sa.Column("filter_select_enabled", sa.Boolean(), default=False)
    )
    op.add_column(
        "tables", sa.Column("filter_select_enabled", sa.Boolean(), default=False)
    )


def downgrade():
    op.drop_column("tables", "filter_select_enabled")
    op.drop_column("datasources", "filter_select_enabled")
