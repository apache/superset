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
"""Add unique constraint on dashboard_versions (dashboard_id, version_number)."""

from superset.migrations.shared.utils import create_index, drop_index

revision = "d4e5f6a7b8c9"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    create_index(
        "dashboard_versions",
        "uq_dashboard_versions_dashboard_id_version_number",
        ["dashboard_id", "version_number"],
        unique=True,
    )


def downgrade() -> None:
    drop_index(
        "dashboard_versions",
        "uq_dashboard_versions_dashboard_id_version_number",
    )
