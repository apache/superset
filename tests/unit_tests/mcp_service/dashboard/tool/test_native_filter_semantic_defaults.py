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

"""Regression tests for semantic native-filter defaults during SQL retargeting."""

import copy
from typing import Any
from unittest.mock import patch

import pytest

from superset.mcp_service.dashboard.schemas import NativeFilterUpdateSpec
from superset.mcp_service.dashboard.tool.manage_native_filters import (
    _merge_filter_update,
)
from tests.unit_tests.mcp_service.dashboard.tool.test_manage_native_filters import (
    _mock_dataset,
    DATASET_FIND_BY_ID,
    EXISTING_RANGE_FILTER,
)


@pytest.mark.parametrize("dataset_id", [5, 7])
@pytest.mark.parametrize("required", [False, True])
@pytest.mark.parametrize("retarget", [False, True])
def test_semantic_numeric_range_default_only_cleared_on_retarget(
    dataset_id: int, required: bool, retarget: bool
) -> None:
    """Clear numeric defaults on SQL retargeting, not presentation-only edits."""
    existing: dict[str, Any] = copy.deepcopy(EXISTING_RANGE_FILTER)
    existing["targets"][0].update(
        datasourceType="semantic_view", semantic_selection_version="v1"
    )
    existing["controlValues"]["enableEmptyFilter"] = required
    mask = {
        "filterState": {"value": [10, 100]},
        "extraFormData": {
            "semantic_selection_sources": [{"datasource": "5__semantic_view"}],
            "filters": [{"col": "cost", "op": ">=", "val": 10}],
        },
    }
    existing["defaultDataMask"] = copy.deepcopy(mask)
    spec = NativeFilterUpdateSpec(
        id=existing["id"],
        dataset_id=dataset_id if retarget else None,
        name="Updated range",
    )
    with patch(DATASET_FIND_BY_ID, return_value=_mock_dataset(["cost"])):
        merged = _merge_filter_update(spec, existing, [])

    assert merged["defaultDataMask"] == (
        {"filterState": {"value": None}, "extraFormData": {}} if retarget else mask
    )
    assert existing["defaultDataMask"] == mask
