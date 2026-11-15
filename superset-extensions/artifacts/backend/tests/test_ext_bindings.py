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
"""The data seam: manifest bindings checked and mapped onto placement data."""

from __future__ import annotations

from typing import Any

import pytest
from superset_core.artifacts.manifest import ArtifactManifest
from superset_oss.artifacts.data.bindings import (
    binding_problems,
    BindingError,
    check_query,
    placement_data_request,
    resolve_binding,
)


def manifest(**binding: Any) -> ArtifactManifest:
    return ArtifactManifest.model_validate(
        {
            "artifact_version": "1",
            "bindings": {
                "revenue": {
                    "source": {"kind": "dataset", "dataset_id": 42},
                    "metrics": ["revenue"],
                    "dimensions": ["region"],
                    **binding,
                }
            },
            "capabilities": ["data"],
        }
    )


def test_a_dataset_binding_maps_onto_the_placement_binding() -> None:
    declared = manifest(
        filters=[{"subject": "country", "operator": "IN", "comparator": ["FR"]}],
        row_limit=500,
    )

    assert resolve_binding(declared, "revenue") == {
        "datasetId": 42,
        "metrics": ["revenue"],
        "dimensions": ["region"],
        "filters": [
            {
                "expressionType": "SIMPLE",
                "subject": "country",
                "operator": "IN",
                "comparator": ["FR"],
            }
        ],
        "rowLimit": 500,
    }
    assert placement_data_request(
        declared, "revenue", [{"datasetId": 42, "column": "region", "values": ["EMEA"]}]
    ) == {
        "binding": "revenue",
        "runtime_filters": [{"datasetId": 42, "column": "region", "values": ["EMEA"]}],
    }


def test_what_doesnt_map_is_refused() -> None:
    chart = ArtifactManifest.model_validate(
        {
            "artifact_version": "1",
            "bindings": {"sales": {"source": {"kind": "chart", "chart_id": 3}}},
            "capabilities": ["data"],
        }
    )
    sql = manifest(filters=[{"expressionType": "SQL", "sqlExpression": "1 = 1"}])

    with pytest.raises(BindingError, match="no binding 'missing'"):
        resolve_binding(chart, "missing")
    with pytest.raises(BindingError, match="chart sources wait for S8"):
        resolve_binding(chart, "sales")
    with pytest.raises(BindingError, match="D2"):
        resolve_binding(sql, "revenue")
    assert len(binding_problems(chart)) == 1
    assert len(binding_problems(sql)) == 1
    assert binding_problems(manifest()) == []


def test_query_values_are_checked_against_the_declared_parameters() -> None:
    declared = manifest(
        parameters={
            "time_range": {"type": "time_range", "default": "Last week"},
            "top": {"type": "number", "required": True},
            "region": {"type": "string", "allowed": ["EMEA", "APAC"]},
            "flags": {"type": "string_list"},
        }
    )

    assert check_query(declared, "revenue", {"top": 5}) == {
        "time_range": "Last week",
        "top": 5,
    }
    with pytest.raises(BindingError, match="declares no parameters other"):
        check_query(declared, "revenue", {"top": 5, "other": 1})
    with pytest.raises(BindingError, match="needs a value"):
        check_query(declared, "revenue", {})
    with pytest.raises(BindingError, match="must be a number"):
        check_query(declared, "revenue", {"top": True})
    with pytest.raises(BindingError, match="doesn't allow"):
        check_query(declared, "revenue", {"top": 1, "region": "LATAM"})
    with pytest.raises(BindingError, match="must be a string_list"):
        check_query(declared, "revenue", {"top": 1, "flags": ["a", 2]})
