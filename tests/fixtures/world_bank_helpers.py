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

"""
Test helper functions for world_bank dataset.
Extracted from the original world_bank.py example file.
"""

from superset.connectors.sqla.models import SqlaTable
from superset.models.slice import Slice


def create_slices(tbl: SqlaTable) -> list[Slice]:
    """Create minimal test slices for world bank data."""
    # Return empty list for now - tests should use YAML examples instead
    return []


# Minimal dashboard position data
dashboard_positions = {
    "DASHBOARD_VERSION_KEY": "v2",
    "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
    "GRID_ID": {
        "children": [],
        "id": "GRID_ID",
        "parents": ["ROOT_ID"],
        "type": "GRID",
    },
}
