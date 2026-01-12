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
# pylint: disable=import-outside-toplevel, unused-argument

from typing import Any


def test_update_id_refs_immune_missing(  # pylint: disable=invalid-name
    app_context: None,
):
    """
    Test that missing immune charts are ignored.

    A chart might be removed from a dashboard but still remain in the list of charts
    immune to filters. The missing chart ID should be simply ignored when the
    dashboard is imported.
    """
    from superset.commands.dashboard.importers.v1.utils import update_id_refs

    config = {
        "position": {
            "CHART1": {
                "id": "CHART1",
                "meta": {
                    "chartId": 101,
                    "uuid": "uuid1",
                },
                "type": "CHART",
            },
            "CHART2": {
                "id": "CHART2",
                "meta": {
                    "chartId": 102,
                    "uuid": "uuid2",
                },
                "type": "CHART",
            },
        },
        "metadata": {
            "filter_scopes": {
                "101": {"filter_name": {"immune": [102, 103]}},
                "104": {"filter_name": {"immune": [102, 103]}},
            },
            "native_filter_configuration": [],
        },
    }
    chart_ids = {"uuid1": 1, "uuid2": 2}
    dataset_info: dict[str, dict[str, Any]] = {}  # not used

    fixed = update_id_refs(config, chart_ids, dataset_info)
    assert fixed == {
        "position": {
            "CHART1": {
                "id": "CHART1",
                "meta": {"chartId": 1, "uuid": "uuid1"},
                "type": "CHART",
            },
            "CHART2": {
                "id": "CHART2",
                "meta": {"chartId": 2, "uuid": "uuid2"},
                "type": "CHART",
            },
        },
        "metadata": {
            "filter_scopes": {"1": {"filter_name": {"immune": [2]}}},
            "native_filter_configuration": [],
        },
    }


def test_update_native_filter_config_scope_excluded():
    from superset.commands.dashboard.importers.v1.utils import update_id_refs

    config = {
        "position": {
            "CHART1": {
                "id": "CHART1",
                "meta": {"chartId": 101, "uuid": "uuid1"},
                "type": "CHART",
            },
            "CHART2": {
                "id": "CHART2",
                "meta": {"chartId": 102, "uuid": "uuid2"},
                "type": "CHART",
            },
        },
        "metadata": {
            "native_filter_configuration": [{"scope": {"excluded": [101, 102, 103]}}],
        },
    }
    chart_ids = {"uuid1": 1, "uuid2": 2}
    dataset_info: dict[str, dict[str, Any]] = {}  # not used

    fixed = update_id_refs(config, chart_ids, dataset_info)
    assert fixed == {
        "position": {
            "CHART1": {
                "id": "CHART1",
                "meta": {"chartId": 1, "uuid": "uuid1"},
                "type": "CHART",
            },
            "CHART2": {
                "id": "CHART2",
                "meta": {"chartId": 2, "uuid": "uuid2"},
                "type": "CHART",
            },
        },
        "metadata": {"native_filter_configuration": [{"scope": {"excluded": [1, 2]}}]},
    }


def test_update_id_refs_cross_filter_chart_configuration_key_and_excluded_mapping():
    from superset.commands.dashboard.importers.v1.utils import update_id_refs

    # Build a minimal dashboard position with uuids -> old ids
    config: dict[str, Any] = {
        "position": {
            "CHART1": {
                "id": "CHART1",
                "meta": {"chartId": 101, "uuid": "uuid1"},
                "type": "CHART",
            },
            "CHART2": {
                "id": "CHART2",
                "meta": {"chartId": 102, "uuid": "uuid2"},
                "type": "CHART",
            },
        },
        "metadata": {
            "chart_configuration": {
                "101": {
                    "id": 101,
                    "crossFilters": {"scope": {"excluded": [102, 103]}},
                },
                "104": {"crossFilters": {"scope": {"excluded": [105]}}},
            },
            "global_chart_configuration": {"scope": {"excluded": [102, 999]}},
        },
    }

    chart_ids = {"uuid1": 1, "uuid2": 2}
    dataset_info: dict[str, dict[str, Any]] = {}

    fixed = update_id_refs(config, chart_ids, dataset_info)

    metadata = fixed["metadata"]
    # Expect top-level key remapped from "101" to "1"
    assert "1" in metadata["chart_configuration"]
    assert "101" not in metadata["chart_configuration"]

    chart_config = metadata["chart_configuration"]["1"]
    # Expect inner id updated to new id
    assert chart_config.get("id") == 1
    # Expect excluded list remapped and unknown ids dropped
    assert chart_config["crossFilters"]["scope"]["excluded"] == [2]

    # Expect entries without id_map mapping to be dropped
    assert "104" not in metadata["chart_configuration"]

    # Expect global scope excluded remapped too
    assert metadata["global_chart_configuration"]["scope"]["excluded"] == [2]


def test_update_id_refs_cross_filter_handles_string_excluded():
    from superset.commands.dashboard.importers.v1.utils import update_id_refs

    config: dict[str, Any] = {
        "position": {
            "CHART1": {
                "id": "CHART1",
                "meta": {"chartId": 101, "uuid": "uuid1"},
                "type": "CHART",
            },
        },
        "metadata": {
            "chart_configuration": {
                "101": {"crossFilters": {"scope": {"excluded": "all"}}}
            }
        },
    }

    chart_ids = {"uuid1": 1}
    dataset_info: dict[str, dict[str, Any]] = {}

    fixed = update_id_refs(config, chart_ids, dataset_info)
    # Should not raise and should remap key
    assert "1" in fixed["metadata"]["chart_configuration"]


def test_update_id_refs_expanded_slices_with_missing_chart():
    """
    Test that missing charts in expanded_slices are gracefully skipped.

    When a chart is deleted from a workspace, dashboards may still contain
    references to the deleted chart ID in expanded_slices metadata. This test
    verifies that the import process skips missing chart references instead of
    raising a KeyError.
    """
    from superset.commands.dashboard.importers.v1.utils import update_id_refs

    config = {
        "position": {
            "CHART1": {
                "id": "CHART1",
                "meta": {"chartId": 101, "uuid": "uuid1"},
                "type": "CHART",
            },
        },
        "metadata": {
            "expanded_slices": {
                "101": True,  # This chart exists in the import
                "102": False,  # This chart was deleted and doesn't exist
                "103": True,  # Another deleted chart
            },
        },
    }
    chart_ids = {"uuid1": 1}  # Only uuid1 exists in the import
    dataset_info: dict[str, dict[str, Any]] = {}

    fixed = update_id_refs(config, chart_ids, dataset_info)

    # Should only include the existing chart, missing charts are skipped
    assert fixed["metadata"]["expanded_slices"] == {"1": True}
    # Should not raise KeyError for missing charts 102 and 103


def test_update_id_refs_timed_refresh_immune_slices_with_missing_chart():
    """
    Test that missing charts in timed_refresh_immune_slices are gracefully skipped.

    When a chart is deleted from a workspace, dashboards may still contain
    references to the deleted chart ID in timed_refresh_immune_slices metadata.
    This test verifies that the import process skips missing chart references
    instead of raising a KeyError.
    """
    from superset.commands.dashboard.importers.v1.utils import update_id_refs

    config = {
        "position": {
            "CHART1": {
                "id": "CHART1",
                "meta": {"chartId": 101, "uuid": "uuid1"},
                "type": "CHART",
            },
            "CHART2": {
                "id": "CHART2",
                "meta": {"chartId": 102, "uuid": "uuid2"},
                "type": "CHART",
            },
        },
        "metadata": {
            "timed_refresh_immune_slices": [
                101,  # This chart exists
                102,  # This chart exists
                103,  # This chart was deleted and doesn't exist
                104,  # Another deleted chart
            ],
        },
    }
    chart_ids = {"uuid1": 1, "uuid2": 2}  # Only uuid1 and uuid2 exist
    dataset_info: dict[str, dict[str, Any]] = {}

    fixed = update_id_refs(config, chart_ids, dataset_info)

    # Should only include existing charts, missing charts are skipped
    assert fixed["metadata"]["timed_refresh_immune_slices"] == [1, 2]
    # Should not raise KeyError for missing charts 103 and 104


def test_update_id_refs_multiple_missing_chart_references():
    """
    Test that multiple metadata fields with missing charts are all handled gracefully.

    This comprehensive test verifies that all metadata fields properly skip
    missing chart references during import.
    """
    from superset.commands.dashboard.importers.v1.utils import update_id_refs

    config = {
        "position": {
            "CHART1": {
                "id": "CHART1",
                "meta": {"chartId": 101, "uuid": "uuid1"},
                "type": "CHART",
            },
        },
        "metadata": {
            "expanded_slices": {
                "101": True,
                "999": False,  # Missing chart
            },
            "timed_refresh_immune_slices": [101, 999],  # 999 is missing
            "filter_scopes": {
                "101": {"region": {"immune": [999]}},  # 999 is missing
                "999": {"region": {"immune": [101]}},  # Key 999 is missing
            },
            "default_filters": '{"101": {"col": "value"}, "999": {"col": "other"}}',
            "native_filter_configuration": [
                {"scope": {"excluded": [101, 999]}}  # 999 is missing
            ],
        },
    }
    chart_ids = {"uuid1": 1}  # Only uuid1 exists
    dataset_info: dict[str, dict[str, Any]] = {}

    fixed = update_id_refs(config, chart_ids, dataset_info)

    # All missing chart references should be gracefully skipped
    assert fixed["metadata"]["expanded_slices"] == {"1": True}
    assert fixed["metadata"]["timed_refresh_immune_slices"] == [1]
    assert fixed["metadata"]["filter_scopes"] == {"1": {"region": {"immune": []}}}
    assert fixed["metadata"]["default_filters"] == '{"1": {"col": "value"}}'
    assert fixed["metadata"]["native_filter_configuration"] == [
        {"scope": {"excluded": [1]}}
    ]
