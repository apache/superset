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

import pytest
from superset_core.exports import export as api
from superset_core.exports.types import ChartResult, GenericDataType, SkipReason


@pytest.mark.parametrize(
    "name, args",
    [
        ("run_query_context", ({},)),
        ("iter_dashboard_chart_results", (1, {})),
        ("describe_dashboard_export", (1, {})),
        ("build_tab_name", ("x", set(), 100)),
        ("can_export_data", ()),
        ("can_export_dashboard", (1,)),
        ("as_user", (1,)),
    ],
)
def test_stub_raises_until_injected(name: str, args: tuple[object, ...]) -> None:
    with pytest.raises(NotImplementedError):
        getattr(api, name)(*args)


def test_skip_reasons_match_excel_error_keys() -> None:
    assert [r.value for r in SkipReason] == [
        "no-query-context",
        "unbounded-query",
        "general-exception",
    ]


def test_chart_result_is_immutable() -> None:
    result = ChartResult(1, "c", [], SkipReason.GENERAL)
    with pytest.raises(AttributeError):
        result.chart_id = 2  # type: ignore[misc]


def test_generic_data_type_matches_host_values() -> None:
    assert [(m.name, m.value) for m in GenericDataType] == [
        ("NUMERIC", 0),
        ("STRING", 1),
        ("TEMPORAL", 2),
        ("BOOLEAN", 3),
        ("MULTI_VALUE", 4),
    ]
