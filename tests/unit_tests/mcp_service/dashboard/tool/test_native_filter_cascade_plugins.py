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

"""Unit regressions for custom native filters in cascade payloads."""

import pytest

from superset.mcp_service.dashboard.schemas import ManageNativeFiltersRequest
from superset.mcp_service.dashboard.tool.manage_native_filters import (
    _build_native_filters_payload,
)


@pytest.mark.parametrize("operation", ["custom_parent", "custom_child", "add_child"])
def test_existing_plugin_cascade_payload(operation: str) -> None:
    """Custom native filters must work in the shared add/update graph builder."""
    parent = {"id": "parent", "type": "NATIVE_FILTER", "filterType": "filter_time"}
    child = {"id": "child", "type": "NATIVE_FILTER", "filterType": "filter_time"}
    (child if operation == "custom_child" else parent)["filterType"] = (
        "custom_native_filter"
    )
    if operation == "add_child":
        request = ManageNativeFiltersRequest.model_validate(
            {
                "dashboard_id": 1,
                "add": [
                    {
                        "filter_type": "filter_time",
                        "name": "Time",
                        "cascade_parent_ids": ["parent"],
                    }
                ],
            }
        )
    else:
        request = ManageNativeFiltersRequest.model_validate(
            {
                "dashboard_id": 1,
                "update": [{"id": "child", "cascade_parent_ids": ["parent"]}],
            }
        )
    payload, _, _ = _build_native_filters_payload(request, [parent, child], [])
    assert len(payload["modified"]) == 1
    assert payload["modified"][0]["cascadeParentIds"] == ["parent"]
