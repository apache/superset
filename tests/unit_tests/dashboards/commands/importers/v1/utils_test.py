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


def test_update_id_refs_preserves_time_grains_in_native_filters():
    """
    Test that time_grains allowlist is preserved during dashboard import.

    The time_grains field is a top-level filter configuration key that should
    survive the update_id_refs transformation without modification.
    """
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
            "native_filter_configuration": [
                {
                    "id": "NATIVE_FILTER-abc123",
                    "filterType": "filter_timegrain",
                    "name": "Time Grain",
                    "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
                    "targets": [{"datasetId": 201, "column": {"name": "dttm"}}],
                    "controlValues": {},
                    "time_grains": ["P1D", "P1W", "P1M"],
                }
            ]
        },
    }

    chart_ids = {"uuid1": 1}
    dataset_info: dict[str, dict[str, Any]] = {}

    fixed = update_id_refs(config, chart_ids, dataset_info)

    # Verify time_grains is preserved unchanged
    filter_config = fixed["metadata"]["native_filter_configuration"][0]
    assert filter_config.get("time_grains") == ["P1D", "P1W", "P1M"]
    assert filter_config.get("filterType") == "filter_timegrain"


def test_find_native_filter_datasets_includes_display_controls():
    """
    Test that find_native_filter_datasets also returns dataset UUIDs
    from chart_customization_config (display controls).
    """
    from superset.commands.dashboard.importers.v1.utils import (
        find_native_filter_datasets,
    )

    metadata = {
        "native_filter_configuration": [
            {"targets": [{"datasetUuid": "uuid-native-1"}]},
        ],
        "chart_customization_config": [
            {"targets": [{"datasetUuid": "uuid-display-1"}]},
            {"targets": [{"datasetUuid": "uuid-display-2"}]},
            {"targets": []},
        ],
    }

    uuids = find_native_filter_datasets(metadata)
    assert uuids == {"uuid-native-1", "uuid-display-1", "uuid-display-2"}


def test_update_id_refs_fixes_display_control_dataset_references():
    """
    Test that update_id_refs converts datasetUuid back to datasetId in
    chart_customization_config (display controls) during import.
    """
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
            "native_filter_configuration": [],
            "chart_customization_config": [
                {
                    "id": "CUSTOMIZATION-abc",
                    "type": "CHART_CUSTOMIZATION",
                    # dual-write format: both fields present in exported bundle
                    "targets": [
                        {
                            "datasetId": 99,
                            "datasetUuid": "ds-uuid-1",
                            "column": {"name": "col"},
                        }
                    ],
                },
                {
                    "id": "CUSTOMIZATION-divider",
                    "type": "CHART_CUSTOMIZATION_DIVIDER",
                    "targets": [],
                },
            ],
        },
    }

    chart_ids = {"uuid1": 1}
    dataset_info: dict[str, dict[str, Any]] = {
        "ds-uuid-1": {"datasource_id": 42},
    }

    fixed = update_id_refs(config, chart_ids, dataset_info)

    customizations = fixed["metadata"]["chart_customization_config"]
    target = customizations[0]["targets"][0]
    assert target["datasetId"] == 42  # updated to destination-env ID
    assert "datasetUuid" not in target  # consumed by import
    assert customizations[1]["targets"] == []


def test_update_id_refs_removes_stale_dataset_id_when_uuid_unresolvable():
    """
    When a target has both datasetId and datasetUuid but the UUID is absent
    from dataset_info, the stale datasetId must also be removed. A visibly
    broken control is safer than one silently bound to whatever dataset
    happens to own that integer ID in the destination environment.
    """
    from superset.commands.dashboard.importers.v1.utils import update_id_refs

    config: dict[str, Any] = {
        "position": {},
        "metadata": {
            "native_filter_configuration": [],
            "chart_customization_config": [
                {
                    "id": "CUSTOMIZATION-abc",
                    "type": "CHART_CUSTOMIZATION",
                    "targets": [{"datasetId": 99, "datasetUuid": "uuid-missing"}],
                },
            ],
        },
    }

    fixed = update_id_refs(config, {}, {})

    target = fixed["metadata"]["chart_customization_config"][0]["targets"][0]
    assert "datasetUuid" not in target
    assert "datasetId" not in target


def test_update_id_refs_skips_display_control_target_on_missing_uuid():
    """
    When a display control target's datasetUuid is absent from dataset_info
    (e.g. a partially corrupt export bundle), update_id_refs skips the target
    silently rather than raising KeyError — the datasetUuid is popped and no
    datasetId is written, leaving the target without a dataset reference.
    """
    from superset.commands.dashboard.importers.v1.utils import update_id_refs

    config: dict[str, Any] = {
        "position": {},
        "metadata": {
            "native_filter_configuration": [],
            "chart_customization_config": [
                {
                    "id": "CUSTOMIZATION-abc",
                    "type": "CHART_CUSTOMIZATION",
                    "targets": [{"datasetUuid": "uuid-missing-from-bundle"}],
                },
            ],
        },
    }

    fixed = update_id_refs(config, {}, {})

    target = fixed["metadata"]["chart_customization_config"][0]["targets"][0]
    assert "datasetUuid" not in target
    assert "datasetId" not in target


def test_update_id_refs_handles_missing_time_grains():
    """
    Test backward compatibility when time_grains is not present.

    Existing filters without time_grains should not break during import.
    """
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
            "native_filter_configuration": [
                {
                    "id": "NATIVE_FILTER-legacy",
                    "filterType": "filter_timegrain",
                    "name": "Legacy Time Grain",
                    "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
                    "targets": [{"datasetId": 201, "column": {"name": "dttm"}}],
                    "controlValues": {},
                    # Note: no time_grains key (legacy filter)
                }
            ]
        },
    }

    chart_ids = {"uuid1": 1}
    dataset_info: dict[str, dict[str, Any]] = {}

    fixed = update_id_refs(config, chart_ids, dataset_info)

    # Verify filter is still valid and legacy payload keeps time_grains absent
    filter_config = fixed["metadata"]["native_filter_configuration"][0]
    assert filter_config.get("filterType") == "filter_timegrain"
    assert "time_grains" not in filter_config
