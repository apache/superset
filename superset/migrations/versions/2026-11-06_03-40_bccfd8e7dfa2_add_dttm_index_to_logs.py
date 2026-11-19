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
"""Add dttm index to logs table

Revision ID: bccfd8e7dfa2
Revises: b8f3a2c91d64
Create Date: 2026-11-06 03:40:00.000000

"""

from superset.migrations.shared.utils import create_index, drop_index

# revision identifiers, used by Alembic.
revision = "bccfd8e7dfa2"
down_revision = "b8f3a2c91d64"

TABLE_NAME = "logs"
INDEX_NAME = "ix_logs_dttm"


def upgrade() -> None:
    """Add an index on logs.dttm."""
    # logs' only index is (user_id, dttm) from cdcf3d64daf4, which leads with
    # user_id -- most engines can't use a composite index to serve a lookup
    # ordered on its trailing column alone. The Activity Log page lists logs
    # ordered by dttm desc with no user filter (see LogMixin.base_order), so
    # every visit is a full table scan without a dedicated index.
    create_index(TABLE_NAME, INDEX_NAME, ["dttm"])


def downgrade() -> None:
    """Drop the logs.dttm index."""
    drop_index(TABLE_NAME, INDEX_NAME)
