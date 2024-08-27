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
"""allow_run_sync_async

Revision ID: 4500485bde7d
Revises: 41f6a59a61f2
Create Date: 2016-09-12 23:33:14.789632

"""

# revision identifiers, used by Alembic.
revision = "4500485bde7d"
down_revision = "41f6a59a61f2"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    op.add_column("dbs", sa.Column("allow_run_async", sa.Boolean(), nullable=True))
    op.add_column("dbs", sa.Column("allow_run_sync", sa.Boolean(), nullable=True))


def downgrade():
    try:
        op.drop_column("dbs", "allow_run_sync")
        op.drop_column("dbs", "allow_run_async")
    except Exception:
        pass
