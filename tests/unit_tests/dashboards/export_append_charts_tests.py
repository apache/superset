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

import uuid

from superset.commands.dashboard import export as export_module


class DummySlice:
    def __init__(self, id_: int, slice_uuid: uuid.UUID, slice_name: str = "chart"):
        self.id = id_
        self.uuid = slice_uuid
        self.slice_name = slice_name


def test_append_deterministic_fields():
    # start with a default position (has ROOT_ID and GRID_ID)
    position = export_module.get_default_position("test")

    # create two dummy slices with known UUIDs
    u1 = uuid.UUID("11111111-1111-1111-1111-111111111111")
    u2 = uuid.UUID("22222222-2222-2222-2222-222222222222")
    s1 = DummySlice(101, u1, "Chart One")
    s2 = DummySlice(102, u2, "Chart Two")
    charts = {s1, s2}

    new_pos = export_module.append_charts(position, charts)

    # chart keys should be CHART-<uuid>
    expected_keys = {f"CHART-{str(u1)}", f"CHART-{str(u2)}"}

    # row key should be ROW-N-<row number>
    # expected row number is 0 since we started with only ROOT_ID and GRID_ID
    expected_row = "ROW-N-0"

    assert expected_row in new_pos, "expected row key in position"
    for k in expected_keys:
        assert k in new_pos, f"expected chart key {k} in position"

    # Ensure meta.uuid equals the chart uuid and chartId equals id
    for chart in (s1, s2):
        key = f"CHART-{str(chart.uuid)}"
        meta = new_pos[key]["meta"]
        assert meta["uuid"] == str(chart.uuid)
        assert meta["chartId"] == chart.id
        assert meta["sliceName"] == chart.slice_name
