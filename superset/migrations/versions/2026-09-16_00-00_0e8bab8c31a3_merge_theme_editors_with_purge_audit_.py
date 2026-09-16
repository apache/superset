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
"""Merge theme_editors/task_dependencies head with purge-audit/username-index head.

Revision ID: 0e8bab8c31a3
Revises: 0884f655c0a6, e2f3a1b9c640
Create Date: 2026-09-16 00:00:00.000000

"""

# revision identifiers, used by Alembic.
revision = "0e8bab8c31a3"
down_revision = ("0884f655c0a6", "e2f3a1b9c640")


def upgrade() -> None:
    """Join both migration branches without changing schema or data."""


def downgrade() -> None:
    """Restore both parent heads without changing schema or data."""
