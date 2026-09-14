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
"""Index dataset dependency lookups.

Revision ID: 8f31c5d726ab
Revises: 39097d124752
Create Date: 2026-08-25 18:00:00.000000

"""

from superset.migrations.shared.utils import create_index, drop_index

revision: str = "8f31c5d726ab"
down_revision: str = "39097d124752"

_SLICE_DATASOURCE_INDEX: str = "ix_slices_datasource_type_datasource_id"
_DASHBOARD_SLICE_INDEX: str = "ix_dashboard_slices_slice_id"


def upgrade() -> None:
    """Add indexes supporting dataset impact collection."""
    create_index(
        "slices",
        _SLICE_DATASOURCE_INDEX,
        ["datasource_type", "datasource_id"],
    )
    create_index(
        "dashboard_slices",
        _DASHBOARD_SLICE_INDEX,
        ["slice_id"],
    )


def downgrade() -> None:
    """Remove dataset impact lookup indexes."""
    drop_index("dashboard_slices", _DASHBOARD_SLICE_INDEX)
    drop_index("slices", _SLICE_DATASOURCE_INDEX)
