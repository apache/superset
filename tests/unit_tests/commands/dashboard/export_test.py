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
from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import MagicMock, patch

import yaml

from superset.utils import json


def _make_mock_dashboard(json_metadata: dict[str, Any]) -> MagicMock:
    dashboard = MagicMock()
    dashboard.dashboard_title = "Test Dashboard"
    dashboard.theme = None
    dashboard.slices = []
    dashboard.tags = []
    dashboard.export_to_dict.return_value = {
        "position_json": json.dumps(
            {
                "DASHBOARD_VERSION_KEY": "v2",
                "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
                "GRID_ID": {
                    "children": [],
                    "id": "GRID_ID",
                    "parents": ["ROOT_ID"],
                    "type": "GRID",
                },
                "HEADER_ID": {
                    "id": "HEADER_ID",
                    "meta": {"text": "Test Dashboard"},
                    "type": "HEADER",
                },
            }
        ),
        "json_metadata": json.dumps(json_metadata),
    }
    return dashboard


def test_file_content_replaces_dataset_id_with_uuid_in_display_controls():
    """
    _file_content must replace datasetId with datasetUuid in chart_customization_config
    targets, mirroring what it already does for native_filter_configuration.
    """
    from superset.commands.dashboard.export import ExportDashboardsCommand

    dataset_uuid = str(uuid.uuid4())

    mock_dashboard = _make_mock_dashboard(
        {
            "native_filter_configuration": [],
            "chart_customization_config": [
                {
                    "id": "CUSTOMIZATION-abc",
                    "type": "CHART_CUSTOMIZATION",
                    "targets": [{"datasetId": 99, "column": {"name": "col"}}],
                },
                {
                    "id": "CUSTOMIZATION-divider",
                    "type": "CHART_CUSTOMIZATION_DIVIDER",
                    "targets": [],
                },
            ],
        }
    )

    mock_dataset = MagicMock()
    mock_dataset.uuid = dataset_uuid

    with (
        patch(
            "superset.commands.dashboard.export.DatasetDAO.find_by_id",
            return_value=mock_dataset,
        ),
        patch(
            "superset.commands.dashboard.export.feature_flag_manager.is_feature_enabled",
            return_value=False,
        ),
    ):
        content = ExportDashboardsCommand._file_content(mock_dashboard)

    result = yaml.safe_load(content)
    customizations = result["metadata"]["chart_customization_config"]

    # datasetUuid must be added; datasetId preserved for backward compat
    target = customizations[0]["targets"][0]
    assert target["datasetUuid"] == dataset_uuid
    assert target["datasetId"] == 99

    # Dividers with no targets must be unaffected
    assert customizations[1]["targets"] == []


def test_export_yields_dataset_files_for_display_controls():
    """
    _export must yield dataset files for datasets referenced by display controls.

    The _export generator has a second pass over json_metadata (separate from
    _file_content) whose job is to emit dataset YAML files into the bundle.
    Without this, the round-trip fails: the UUID is in the dashboard YAML but
    the dataset file is absent from the ZIP.
    """
    from superset.commands.dashboard.export import ExportDashboardsCommand

    dataset_id = 42
    mock_dashboard = _make_mock_dashboard(
        {
            "native_filter_configuration": [],
            "chart_customization_config": [
                {
                    "id": "CUSTOMIZATION-abc",
                    "type": "CHART_CUSTOMIZATION",
                    "targets": [{"datasetId": dataset_id}],
                },
            ],
        }
    )

    mock_dataset = MagicMock()
    sentinel_file = ("datasets/my_dataset.yaml", lambda: "dataset_content")
    mock_datasets_cmd = MagicMock()
    mock_datasets_cmd.run.return_value = iter([sentinel_file])

    with (
        patch(
            "superset.commands.dashboard.export.DatasetDAO.find_by_id",
            return_value=mock_dataset,
        ),
        patch(
            "superset.commands.dashboard.export.ExportDatasetsCommand",
            return_value=mock_datasets_cmd,
        ) as mock_datasets_cls,
        patch(
            "superset.commands.dashboard.export.ExportChartsCommand"
        ) as mock_charts_cls,
        patch(
            "superset.commands.dashboard.export.feature_flag_manager.is_feature_enabled",
            return_value=False,
        ),
    ):
        mock_charts_cls.return_value.run.return_value = iter([])
        results = list(ExportDashboardsCommand._export(mock_dashboard))

    mock_datasets_cls.assert_called_once_with([dataset_id])
    mock_datasets_cmd.run.assert_called_once()
    filenames = [name for name, _ in results]
    assert "datasets/my_dataset.yaml" in filenames


def test_file_content_null_chart_customization_config_does_not_raise():
    """
    When chart_customization_config is explicitly null in metadata,
    _file_content must not raise — the `or []` guard handles it.
    """
    from superset.commands.dashboard.export import ExportDashboardsCommand

    mock_dashboard = _make_mock_dashboard(
        {
            "native_filter_configuration": [],
            "chart_customization_config": None,
        }
    )

    with patch(
        "superset.commands.dashboard.export.feature_flag_manager.is_feature_enabled",
        return_value=False,
    ):
        content = ExportDashboardsCommand._file_content(mock_dashboard)

    result = yaml.safe_load(content)
    assert result["metadata"]["chart_customization_config"] is None


def test_file_content_omits_roles_field():
    """
    Dashboard export no longer emits resource-level role restrictions.
    """
    from superset.commands.dashboard.export import ExportDashboardsCommand

    mock_dashboard = _make_mock_dashboard({"native_filter_configuration": []})

    with patch(
        "superset.commands.dashboard.export.feature_flag_manager.is_feature_enabled",
        return_value=False,
    ):
        content = ExportDashboardsCommand._file_content(mock_dashboard)

    result = yaml.safe_load(content)
    assert "roles" not in result


def test_position_json_chart_id_is_stable_across_environments() -> None:
    """
    Regression for #32972: dashboard export must produce stable output that does
    not vary with env-local integer chartIds.

    The export format includes a ``meta.chartId`` field inside each ``CHART-*``
    position entry. Historically that integer was the database auto-increment
    primary key from the source environment. When a bundle is imported into a
    different environment the importer (``update_id_refs``) rewrites those IDs to
    the destination-env primary keys, so a second export from the destination
    would serialize the new env-local integers — the same logical chart produced
    different ``chartId`` values in each environment.

    The exporter now derives ``meta.chartId`` from the (stable) ``meta.uuid``
    instead, so this test asserts that two exports of the same logical dashboard
    agree on ``chartId`` even when the underlying chart has a different integer
    primary key in each environment.
    """
    from superset.commands.dashboard.export import ExportDashboardsCommand

    chart_uuid = "812bc377-ac09-475a-8d34-a63f7f087bd7"

    # ------------------------------------------------------------------ #
    # Source environment: chart has auto-increment id = 392               #
    # ------------------------------------------------------------------ #
    source_position = {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
        "GRID_ID": {
            "children": ["CHART-srcAAA"],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "HEADER_ID": {
            "id": "HEADER_ID",
            "meta": {"text": "My Dashboard"},
            "type": "HEADER",
        },
        "CHART-srcAAA": {
            "children": [],
            "id": "CHART-srcAAA",
            "meta": {
                "chartId": 392,  # source-env integer primary key
                "height": 20,
                "sliceName": "My Wonderful Chart",
                "uuid": chart_uuid,
                "width": 4,
            },
            "parents": ["ROOT_ID", "GRID_ID"],
            "type": "CHART",
        },
    }

    src_dashboard = MagicMock()
    src_dashboard.dashboard_title = "My Dashboard"
    src_dashboard.theme = None
    src_dashboard.slices = []
    src_dashboard.tags = []
    src_dashboard.export_to_dict.return_value = {
        "position_json": json.dumps(source_position),
        "json_metadata": json.dumps({"native_filter_configuration": []}),
    }

    with patch(
        "superset.commands.dashboard.export.feature_flag_manager.is_feature_enabled",
        return_value=False,
    ):
        first_export_content = ExportDashboardsCommand._file_content(src_dashboard)

    first_export = yaml.safe_load(first_export_content)
    first_chart_positions = [
        node
        for node in first_export["position"].values()
        if isinstance(node, dict) and node.get("type") == "CHART"
    ]
    assert first_chart_positions, "Export must contain at least one CHART position node"
    first_chart_meta = first_chart_positions[0]["meta"]

    # uuid must be present — it is the stable cross-environment identifier
    assert first_chart_meta.get("uuid") == chart_uuid, (
        "meta.uuid must be present in exported position_json; "
        "it is the stable identifier that survives re-import."
    )

    # ------------------------------------------------------------------ #
    # Destination environment: same chart receives a different id = 1001  #
    # (This is what happens after import — update_id_refs rewrites the    #
    # chartId field inside position_json to the destination-env integer.) #
    # ------------------------------------------------------------------ #
    dest_position = {
        k: (
            {
                **v,
                "meta": {
                    **v["meta"],
                    "chartId": 1001,  # destination-env integer primary key
                },
            }
            if isinstance(v, dict)
            and v.get("type") == "CHART"
            and v.get("meta", {}).get("uuid") == chart_uuid
            else v
        )
        for k, v in source_position.items()
    }

    dest_dashboard = MagicMock()
    dest_dashboard.dashboard_title = "My Dashboard"
    dest_dashboard.theme = None
    dest_dashboard.slices = []
    dest_dashboard.tags = []
    dest_dashboard.export_to_dict.return_value = {
        "position_json": json.dumps(dest_position),
        "json_metadata": json.dumps({"native_filter_configuration": []}),
    }

    with patch(
        "superset.commands.dashboard.export.feature_flag_manager.is_feature_enabled",
        return_value=False,
    ):
        second_export_content = ExportDashboardsCommand._file_content(dest_dashboard)

    second_export = yaml.safe_load(second_export_content)
    second_chart_positions = [
        node
        for node in second_export["position"].values()
        if isinstance(node, dict) and node.get("type") == "CHART"
    ]
    assert second_chart_positions, "Second export must contain at least one CHART node"
    second_chart_meta = second_chart_positions[0]["meta"]

    # uuid must survive the re-import round-trip unchanged
    assert second_chart_meta.get("uuid") == chart_uuid, (
        "meta.uuid must be stable across export → import → re-export; "
        "UUIDs are the cross-environment identity, not integer IDs."
    )

    # ------------------------------------------------------------------ #
    # THE INVARIANT: chartId must be stable across environments.         #
    #                                                                     #
    # The source-env export and the destination-env export (whose        #
    # position_json carries a different env-local integer after import)   #
    # must agree on chartId, because it is derived from the stable        #
    # meta.uuid rather than the env-local primary key.                    #
    # ------------------------------------------------------------------ #
    first_chart_id = first_chart_meta.get("chartId")
    second_chart_id = second_chart_meta.get("chartId")

    assert first_chart_id == second_chart_id, (
        f"meta.chartId must be stable across environments, but the source-env "
        f"export produced chartId={first_chart_id!r} while the destination-env "
        f"export (after re-import with remapped IDs) produced "
        f"chartId={second_chart_id!r}. "
        "Env-local integer IDs must not leak into the export format (issue "
        "#32972); chartId is derived from meta.uuid so the export stays "
        "environment-independent."
    )


def _export_with_chart(
    chart_uuid: str,
    chart_id: int,
    json_metadata: dict[str, Any],
) -> dict[str, Any]:
    """Export a single-chart dashboard and return the parsed YAML payload."""
    from superset.commands.dashboard.export import ExportDashboardsCommand

    position = {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
        "GRID_ID": {
            "children": ["CHART-aaa"],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "CHART-aaa": {
            "children": [],
            "id": "CHART-aaa",
            "meta": {
                "chartId": chart_id,
                "height": 20,
                "sliceName": "Chart",
                "uuid": chart_uuid,
                "width": 4,
            },
            "parents": ["ROOT_ID", "GRID_ID"],
            "type": "CHART",
        },
    }

    dashboard = MagicMock()
    dashboard.dashboard_title = "Test Dashboard"
    dashboard.theme = None
    dashboard.slices = []
    dashboard.tags = []
    dashboard.export_to_dict.return_value = {
        "position_json": json.dumps(position),
        "json_metadata": json.dumps(json_metadata),
    }

    with patch(
        "superset.commands.dashboard.export.feature_flag_manager.is_feature_enabled",
        return_value=False,
    ):
        content = ExportDashboardsCommand._file_content(dashboard)

    return yaml.safe_load(content)


def test_orphan_chart_gets_uuid_derived_chart_id() -> None:
    """
    A chart in ``model.slices`` that is NOT referenced in ``position_json`` is
    appended via ``append_charts`` (which writes the env-local ``chart.id``).
    ``_stabilize_chart_ids`` runs afterwards, so the appended node must end up
    with a UUID-derived ``chartId`` rather than the env-local integer.
    """
    from superset.commands.dashboard.export import (
        ExportDashboardsCommand,
        stable_chart_id,
    )

    chart_uuid = "812bc377-ac09-475a-8d34-a63f7f087bd7"
    env_local_id = 392

    orphan = MagicMock()
    orphan.id = env_local_id
    orphan.uuid = chart_uuid
    orphan.slice_name = "Orphan Chart"

    # position_json references no charts, so ``orphan`` is appended as an orphan.
    mock_dashboard = _make_mock_dashboard({"native_filter_configuration": []})
    mock_dashboard.slices = [orphan]

    with patch(
        "superset.commands.dashboard.export.feature_flag_manager.is_feature_enabled",
        return_value=False,
    ):
        content = ExportDashboardsCommand._file_content(mock_dashboard)

    result = yaml.safe_load(content)
    chart_nodes = [
        node
        for node in result["position"].values()
        if isinstance(node, dict) and node.get("type") == "CHART"
    ]
    assert chart_nodes, "Orphan chart must be appended to the position tree"
    chart_meta = chart_nodes[0]["meta"]
    assert chart_meta["uuid"] == chart_uuid
    # The env-local id must have been stabilized away, not serialized verbatim.
    assert chart_meta["chartId"] == stable_chart_id(chart_uuid)
    assert chart_meta["chartId"] != env_local_id


def test_stabilize_chart_ids_skips_invalid_uuid() -> None:
    """A malformed meta.uuid must not abort the whole dashboard export."""
    result = _export_with_chart(
        "not-a-valid-uuid",
        392,
        {"native_filter_configuration": []},
    )
    chart_nodes = [
        node
        for node in result["position"].values()
        if isinstance(node, dict) and node.get("type") == "CHART"
    ]
    # Export still succeeds; the unstabilizable node keeps its original chartId.
    assert chart_nodes
    assert chart_nodes[0]["meta"]["chartId"] == 392


def test_stabilize_chart_ids_remaps_native_filter_scope() -> None:
    """Native filter scope.excluded / chartsInScope must track the stabilized id."""
    from superset.commands.dashboard.export import stable_chart_id

    chart_uuid = "812bc377-ac09-475a-8d34-a63f7f087bd7"
    new_id = stable_chart_id(chart_uuid)

    result = _export_with_chart(
        chart_uuid,
        392,
        {
            "native_filter_configuration": [
                {
                    "id": "NATIVE_FILTER-1",
                    "scope": {"rootPath": ["ROOT_ID"], "excluded": [392]},
                    "chartsInScope": [392],
                }
            ]
        },
    )

    native_filter = result["metadata"]["native_filter_configuration"][0]
    assert native_filter["scope"]["excluded"] == [new_id]
    assert native_filter["chartsInScope"] == [new_id]


def test_stabilize_chart_ids_remaps_cross_filter_configuration() -> None:
    """global_chart_configuration and chart_configuration must be remapped."""
    from superset.commands.dashboard.export import stable_chart_id

    chart_uuid = "812bc377-ac09-475a-8d34-a63f7f087bd7"
    new_id = stable_chart_id(chart_uuid)

    result = _export_with_chart(
        chart_uuid,
        392,
        {
            "native_filter_configuration": [],
            "global_chart_configuration": {
                "scope": {"rootPath": ["ROOT_ID"], "excluded": [392]},
                "chartsInScope": [392],
            },
            "chart_configuration": {
                "392": {
                    "id": 392,
                    "crossFilters": {
                        "scope": {"rootPath": ["ROOT_ID"], "excluded": [392]},
                        "chartsInScope": [392],
                    },
                }
            },
        },
    )

    metadata = result["metadata"]
    assert metadata["global_chart_configuration"]["scope"]["excluded"] == [new_id]
    assert metadata["global_chart_configuration"]["chartsInScope"] == [new_id]

    # chart_configuration is re-keyed and its inner id / scopes are remapped.
    assert str(new_id) in metadata["chart_configuration"]
    chart_config = metadata["chart_configuration"][str(new_id)]
    assert chart_config["id"] == new_id
    assert chart_config["crossFilters"]["scope"]["excluded"] == [new_id]
    assert chart_config["crossFilters"]["chartsInScope"] == [new_id]


def test_stable_chart_id_is_deterministic_and_in_range() -> None:
    """
    stable_chart_id must derive a stable, environment-independent integer from a
    chart UUID. The same UUID always yields the same id, and the id stays within
    the positive signed 32-bit range so it can stand in for a database
    auto-increment primary key without colliding with the sign bit.
    """
    from superset.commands.dashboard.export import (
        _STABLE_CHART_ID_MODULO,
        stable_chart_id,
    )

    chart_uuid = "812bc377-ac09-475a-8d34-a63f7f087bd7"

    # Deterministic: repeated derivations of the same UUID agree.
    assert stable_chart_id(chart_uuid) == stable_chart_id(chart_uuid)

    # Distinct UUIDs map to distinct ids (no accidental collapse).
    other_uuid = "00000000-0000-4000-8000-000000000001"
    assert stable_chart_id(chart_uuid) != stable_chart_id(other_uuid)

    # Bounded to [1, _STABLE_CHART_ID_MODULO] for any UUID, including one whose
    # high bits are all set (boundary case). Static inputs keep the test
    # deterministic.
    high_bits_uuid = "ffffffff-ffff-4fff-bfff-ffffffffffff"
    for candidate in (chart_uuid, other_uuid, high_bits_uuid):
        derived = stable_chart_id(candidate)
        assert 1 <= derived <= _STABLE_CHART_ID_MODULO


def test_stabilize_chart_ids_remaps_default_filters() -> None:
    """
    default_filters is a JSON *string* keyed by env-local chart id. The exporter
    must parse it, remap the top-level keys to the stabilized ids, and re-emit it
    as a JSON string so the bundle never leaks the source-env integer.
    """
    from superset.commands.dashboard.export import stable_chart_id

    chart_uuid = "812bc377-ac09-475a-8d34-a63f7f087bd7"
    new_id = stable_chart_id(chart_uuid)

    result = _export_with_chart(
        chart_uuid,
        392,
        {
            "native_filter_configuration": [],
            "default_filters": json.dumps({"392": {"__time_range": "No filter"}}),
        },
    )

    # default_filters round-trips as a JSON string keyed by the stabilized id.
    default_filters = json.loads(result["metadata"]["default_filters"])
    assert str(new_id) in default_filters
    assert "392" not in default_filters
    assert default_filters[str(new_id)] == {"__time_range": "No filter"}


def test_stabilize_chart_ids_remaps_timed_refresh_immune_slices() -> None:
    """
    timed_refresh_immune_slices is a flat list of env-local chart ids. Each entry
    must be remapped to the stabilized id so the immune list keeps pointing at the
    same logical charts after a cross-environment round-trip.
    """
    from superset.commands.dashboard.export import stable_chart_id

    chart_uuid = "812bc377-ac09-475a-8d34-a63f7f087bd7"
    new_id = stable_chart_id(chart_uuid)

    result = _export_with_chart(
        chart_uuid,
        392,
        {
            "native_filter_configuration": [],
            "timed_refresh_immune_slices": [392],
        },
    )

    assert result["metadata"]["timed_refresh_immune_slices"] == [new_id]


def test_stabilize_chart_ids_remaps_filter_scopes_keys_and_immune() -> None:
    """
    filter_scopes is a dict keyed by env-local chart id, whose values hold nested
    per-column ``immune`` lists of chart ids. The exporter must remap BOTH the
    top-level keys AND the nested immune arrays to the stabilized ids.
    """
    from superset.commands.dashboard.export import stable_chart_id

    chart_uuid = "812bc377-ac09-475a-8d34-a63f7f087bd7"
    new_id = stable_chart_id(chart_uuid)

    result = _export_with_chart(
        chart_uuid,
        392,
        {
            "native_filter_configuration": [],
            "filter_scopes": {
                "392": {
                    "region": {
                        "scope": ["ROOT_ID"],
                        "immune": [392],
                    }
                }
            },
        },
    )

    filter_scopes = result["metadata"]["filter_scopes"]
    # Top-level key remapped to the stabilized id (and the old key is gone).
    assert str(new_id) in filter_scopes
    assert "392" not in filter_scopes
    # Nested immune array remapped too.
    assert filter_scopes[str(new_id)]["region"]["immune"] == [new_id]


def test_stabilize_chart_ids_remaps_expanded_slices() -> None:
    """
    expanded_slices is a dict keyed by env-local chart id. The exporter must
    re-key it to the stabilized ids while preserving the values.
    """
    from superset.commands.dashboard.export import stable_chart_id

    chart_uuid = "812bc377-ac09-475a-8d34-a63f7f087bd7"
    new_id = stable_chart_id(chart_uuid)

    result = _export_with_chart(
        chart_uuid,
        392,
        {
            "native_filter_configuration": [],
            "expanded_slices": {"392": True},
        },
    )

    expanded_slices = result["metadata"]["expanded_slices"]
    assert str(new_id) in expanded_slices
    assert "392" not in expanded_slices
    assert expanded_slices[str(new_id)] is True


def test_file_content_missing_dataset_preserves_dataset_id() -> None:
    """
    When DatasetDAO.find_by_id returns None for a display control target,
    datasetId is preserved (dual-write: it was never popped) and no
    datasetUuid is added — the target is not silently emptied.
    """
    from superset.commands.dashboard.export import ExportDashboardsCommand

    mock_dashboard = _make_mock_dashboard(
        {
            "chart_customization_config": [
                {
                    "id": "CUSTOMIZATION-orphan",
                    "type": "CHART_CUSTOMIZATION",
                    "targets": [{"datasetId": 9999}],
                },
            ],
        }
    )

    with (
        patch(
            "superset.commands.dashboard.export.DatasetDAO.find_by_id",
            return_value=None,
        ),
        patch(
            "superset.commands.dashboard.export.feature_flag_manager.is_feature_enabled",
            return_value=False,
        ),
    ):
        content = ExportDashboardsCommand._file_content(mock_dashboard)

    result = yaml.safe_load(content)
    target = result["metadata"]["chart_customization_config"][0]["targets"][0]
    assert target["datasetId"] == 9999
    assert "datasetUuid" not in target


def test_stabilize_chart_ids_resolves_id_collisions() -> None:
    """
    Two charts whose UUIDs reduce to the same derived id must still get distinct
    stabilized ids, so the chart-keyed metadata remaps (filter_scopes,
    chart_configuration, …) never silently overwrite one another. The forced
    collision is simulated by stubbing ``stable_chart_id`` to a constant.
    """
    from superset.commands.dashboard.export import _stabilize_chart_ids

    uuid_a = "00000000-0000-4000-8000-00000000000a"
    uuid_b = "00000000-0000-4000-8000-00000000000b"
    payload: dict[str, Any] = {
        "position": {
            "CHART-a": {
                "type": "CHART",
                "meta": {"chartId": 1, "uuid": uuid_a},
            },
            "CHART-b": {
                "type": "CHART",
                "meta": {"chartId": 2, "uuid": uuid_b},
            },
        },
        "metadata": {
            "expanded_slices": {"1": True, "2": False},
        },
    }

    with patch(
        "superset.commands.dashboard.export.stable_chart_id",
        return_value=100,
    ):
        _stabilize_chart_ids(payload)

    id_a = payload["position"]["CHART-a"]["meta"]["chartId"]
    id_b = payload["position"]["CHART-b"]["meta"]["chartId"]
    # Distinct ids despite the collision; one keeps the derived value, the other
    # is deterministically probed forward.
    assert id_a != id_b
    assert {id_a, id_b} == {100, 101}
    # Neither expanded_slices entry was dropped by a key clash.
    assert set(payload["metadata"]["expanded_slices"]) == {str(id_a), str(id_b)}
