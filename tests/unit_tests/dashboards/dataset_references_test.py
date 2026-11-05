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

from typing import Any

import pytest

from superset.dashboards.dataset_references import (
    dashboard_dataset_ids,
    parse_dashboard_metadata,
)


def test_dashboard_dataset_ids_reads_filters_and_display_controls() -> None:
    metadata = {
        "native_filter_configuration": [
            {"targets": [{"datasetId": 1}, {"datasetId": "2"}]},
        ],
        "chart_customization_config": [{"targets": [{"datasetId": 3}]}],
    }

    assert dashboard_dataset_ids(metadata) == {1, 2, 3}


def test_dashboard_dataset_ids_skips_non_table_targets() -> None:
    metadata = {
        "native_filter_configuration": [
            {
                "targets": [
                    {"datasetId": 1, "datasourceType": "table"},
                    {"datasetId": 2, "datasourceType": "semantic_view"},
                ]
            },
        ],
    }

    assert dashboard_dataset_ids(metadata) == {1}


@pytest.mark.parametrize(
    "metadata",
    [
        {},
        {"native_filter_configuration": None},
        {"native_filter_configuration": "oops"},
        {"native_filter_configuration": ["oops", None, 3]},
        {"native_filter_configuration": [{}]},
        {"native_filter_configuration": [{"targets": None}]},
        {"native_filter_configuration": [{"targets": "oops"}]},
        {"native_filter_configuration": [{"targets": ["oops", None]}]},
        {"native_filter_configuration": [{"targets": [{"datasetId": True}]}]},
        {"native_filter_configuration": [{"targets": [{"datasetId": "1.5"}]}]},
        {"native_filter_configuration": [{"targets": [{"datasetId": None}]}]},
        {"chart_customization_config": {"targets": [{"datasetId": 1}]}},
    ],
)
def test_dashboard_dataset_ids_ignores_malformed_configuration(
    metadata: dict[str, Any],
) -> None:
    assert dashboard_dataset_ids(metadata) == set()


@pytest.mark.parametrize(
    "json_metadata",
    [None, "", "{not json", "[]", '"text"', "5", "null"],
)
def test_parse_dashboard_metadata_returns_empty_for_unusable_metadata(
    json_metadata: str | None,
) -> None:
    assert parse_dashboard_metadata(json_metadata) == {}


def test_parse_dashboard_metadata_returns_the_parsed_object() -> None:
    assert parse_dashboard_metadata('{"a": 1}') == {"a": 1}
