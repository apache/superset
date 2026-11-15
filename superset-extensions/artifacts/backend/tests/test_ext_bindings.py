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
    assert binding_problems(declared) == []


def test_what_doesnt_map_is_refused() -> None:
    chart = ArtifactManifest.model_validate(
        {
            "artifact_version": "1",
            "bindings": {"sales": {"source": {"kind": "chart", "chart_id": 3}}},
            "capabilities": ["data"],
        }
    )
    sql = manifest(
        filters=[
            {"expressionType": "SQL", "sqlExpression": "1 = 1"},
            {"subject": "country", "operator": "IN"},
            {"operator": "IN"},
        ]
    )

    with pytest.raises(BindingError, match="no binding 'missing'"):
        resolve_binding(chart, "missing")
    with pytest.raises(BindingError, match="chart sources don't map"):
        resolve_binding(chart, "sales")
    with pytest.raises(BindingError) as refused:
        resolve_binding(sql, "revenue")
    assert str(refused.value) == (
        "binding 'revenue', filters[0]: only simple filters map, not SQL "
        "expressions; filters[2]: a filter needs a subject column and an operator"
    )
    assert binding_problems(chart) == [
        "binding 'sales': chart sources don't map onto placement data yet; "
        "bind a dataset"
    ]
    assert binding_problems(sql) == [str(refused.value)]
