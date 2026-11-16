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
"""Index SQL Lab preparation cleanup.

Revision ID: 9a7d3b6e21c4
Revises: b8f3a2c91d64
Create Date: 2026-11-16 12:30:00.000000

"""

from superset.migrations.shared.utils import create_index, drop_index

revision: str = "9a7d3b6e21c4"
down_revision: str = "b8f3a2c91d64"


def upgrade() -> None:
    """Index the status and expiry predicates without changing query records."""
    create_index("query", "ix_query_status_start_time", ["status", "start_time"])


def downgrade() -> None:
    """Remove the preparation cleanup index."""
    drop_index("query", "ix_query_status_start_time")
