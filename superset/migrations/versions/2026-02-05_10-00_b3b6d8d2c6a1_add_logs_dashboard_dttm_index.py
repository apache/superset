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
"""add logs dashboard_id+dttm index

Revision ID: b3b6d8d2c6a1
Revises: 9787190b3d89
Create Date: 2026-02-05 10:00:00.000000

"""

from alembic import op

from superset.migrations.shared.utils import create_index, drop_index

# revision identifiers, used by Alembic.
revision = "b3b6d8d2c6a1"
down_revision = "9787190b3d89"


def upgrade():
    create_index(
        table_name="logs",
        index_name=op.f("ix_logs_dashboard_id_dttm"),
        columns=["dashboard_id", "dttm"],
        unique=False,
    )


def downgrade():
    drop_index(
        table_name="logs",
        index_name=op.f("ix_logs_dashboard_id_dttm"),
    )
