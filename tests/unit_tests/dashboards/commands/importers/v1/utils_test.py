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


def test_update_native_filter_charts_in_scope() -> None:
    """
    Test that chartsInScope references in native filters are updated during import.

    This is a fix for issue #26338 - chartsInScope references were not being
    updated to use new chart IDs during dashboard import.
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
            "native_filter_configuration": [{"chartsInScope": [101, 102, 103]}],
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
        "metadata": {"native_filter_configuration": [{"chartsInScope": [1, 2]}]},
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


def test_update_id_refs_cross_filter_uuid_keyed_config_remapped() -> None:
    """
    Test that UUID-keyed chart_configuration entries (from example exports) are
    properly remapped to new integer IDs during import, including UUID values in
    chartsInScope.

    export_example.remap_chart_configuration produces chart_configuration keyed by
    chart UUIDs with UUID values in crossFilters.chartsInScope.
    """
    from superset.commands.dashboard.importers.v1.utils import update_id_refs

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
                # UUID-keyed format from export_example
                "uuid1": {
                    "id": "uuid1",
                    "crossFilters": {
                        "chartsInScope": ["uuid2"],  # UUID reference
                        "scope": {"excluded": []},
                    },
                },
                "uuid2": {
                    "id": "uuid2",
                    "crossFilters": {
                        "chartsInScope": ["uuid1"],  # UUID reference
                        "scope": {"excluded": []},
                    },
                },
            }
        },
    }

    chart_ids = {"uuid1": 1, "uuid2": 2}
    dataset_info: dict[str, dict[str, Any]] = {}

    fixed = update_id_refs(config, chart_ids, dataset_info)

    chart_cfg = fixed["metadata"]["chart_configuration"]
    # UUID keys should be remapped to new integer keys
    assert "1" in chart_cfg
    assert "2" in chart_cfg
    assert "uuid1" not in chart_cfg
    assert "uuid2" not in chart_cfg
    # Inner id fields should be new integer IDs
    assert chart_cfg["1"]["id"] == 1
    assert chart_cfg["2"]["id"] == 2
    # chartsInScope UUIDs should be remapped to new integer IDs
    assert chart_cfg["1"]["crossFilters"]["chartsInScope"] == [2]
    assert chart_cfg["2"]["crossFilters"]["chartsInScope"] == [1]


def test_update_id_refs_cross_filter_uuid_keyed_unknown_preserved() -> None:
    """
    Test that UUID-keyed chart_configuration entries with no matching position
    entry are preserved unchanged rather than silently dropped.
    """
    from superset.commands.dashboard.importers.v1.utils import update_id_refs

    unknown_uuid = "ffffffff-0000-0000-0000-000000000000"
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
                "101": {"id": 101, "crossFilters": {"scope": {"excluded": []}}},
                unknown_uuid: {"id": unknown_uuid, "crossFilters": {}},
            }
        },
    }

    chart_ids = {"uuid1": 1}
    dataset_info: dict[str, dict[str, Any]] = {}

    fixed = update_id_refs(config, chart_ids, dataset_info)

    chart_cfg = fixed["metadata"]["chart_configuration"]
    # Integer-keyed entry should be remapped
    assert "1" in chart_cfg
    assert "101" not in chart_cfg
    # Unknown UUID-keyed entry should be preserved unchanged
    assert unknown_uuid in chart_cfg


def test_update_id_refs_cross_filter_charts_in_scope() -> None:
    """
    Test that chartsInScope references in cross-filter configurations are updated.

    This is a fix for issue #26338 - chartsInScope references in chart_configuration
    and global_chart_configuration were not being updated during dashboard import.
    """
    from superset.commands.dashboard.importers.v1.utils import update_id_refs

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
            "CHART3": {
                "id": "CHART3",
                "meta": {"chartId": 103, "uuid": "uuid3"},
                "type": "CHART",
            },
        },
        "metadata": {
            "chart_configuration": {
                "101": {
                    "id": 101,
                    "crossFilters": {
                        "chartsInScope": [102, 103],
                        "scope": {"excluded": [101]},
                    },
                },
                "102": {
                    "id": 102,
                    "crossFilters": {
                        "chartsInScope": [101, 103, 999],  # 999 should be dropped
                        "scope": {"excluded": []},
                    },
                },
            },
            "global_chart_configuration": {
                "chartsInScope": [101, 102, 103, 999],  # 999 should be dropped
                "scope": {"excluded": [103]},
            },
        },
    }

    chart_ids = {"uuid1": 1, "uuid2": 2, "uuid3": 3}
    dataset_info: dict[str, dict[str, Any]] = {}

    fixed = update_id_refs(config, chart_ids, dataset_info)

    metadata = fixed["metadata"]

    # Check chart_configuration chartsInScope is updated
    assert metadata["chart_configuration"]["1"]["crossFilters"]["chartsInScope"] == [
        2,
        3,
    ]
    assert metadata["chart_configuration"]["2"]["crossFilters"]["chartsInScope"] == [
        1,
        3,
    ]

    # Check global_chart_configuration chartsInScope is updated
    assert metadata["global_chart_configuration"]["chartsInScope"] == [1, 2, 3]
    assert metadata["global_chart_configuration"]["scope"]["excluded"] == [3]
