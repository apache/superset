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

import ast
import re
from pathlib import Path

from superset.utils.geographic_world import WORLD_BOUNDARY_IDS


def test_world_boundary_ids_match_frontend_snapshot() -> None:
    """Keep backend boundaries aligned with the topology-checked frontend set."""
    frontend = (
        Path(__file__).resolve().parents[3]
        / "superset-frontend/plugins/plugin-chart-world-map/src/worldGeometry.ts"
    ).read_text(encoding="utf-8")
    snapshot = re.search(
        r"export const WORLD_BOUNDARY_IDS = new Set\((\[.*?\])\);",
        frontend,
        re.DOTALL,
    )
    assert snapshot is not None
    assert set(ast.literal_eval(snapshot.group(1))) == WORLD_BOUNDARY_IDS
