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


def test_file_content_includes_roles_for_dashboard_with_role_restrictions():
    """
    Regression guard for #21000: dashboards restricted via DASHBOARD_RBAC must
    have their role assignments included in the exported YAML. Without this,
    importing the bundle into another environment recreates the dashboard with
    no role restriction — silently turning a restricted dashboard into a
    publicly accessible one.

    The export bundle is the canonical source of truth for migrating
    dashboards across environments; dropping roles silently is a security
    regression (a "least privilege" dashboard becomes "all privileges" on
    import). The user, not the export pipeline, should decide whether to
    strip roles before sharing a bundle.

    We assert against role *names* rather than IDs because role IDs are
    environment-local; the import side resolves names back to the destination
    environment's roles.
    """
    from superset.commands.dashboard.export import ExportDashboardsCommand

    role_alpha = MagicMock()
    role_alpha.name = "Finance"
    role_beta = MagicMock()
    role_beta.name = "Executives"

    mock_dashboard = _make_mock_dashboard({"native_filter_configuration": []})
    mock_dashboard.roles = [role_alpha, role_beta]

    with patch(
        "superset.commands.dashboard.export.feature_flag_manager.is_feature_enabled",
        return_value=False,
    ):
        content = ExportDashboardsCommand._file_content(mock_dashboard)

    result = yaml.safe_load(content)
    assert "roles" in result, (
        "Dashboard export must include role names; without them, importing "
        "into a fresh environment loses the role-based access restriction "
        "and the dashboard becomes accessible to all roles by default."
    )
    assert sorted(result["roles"]) == ["Executives", "Finance"]


def test_file_content_omits_roles_field_when_dashboard_has_no_roles():
    """
    A dashboard with no role restrictions must not emit an empty ``roles: []``
    key. Older bundles in the wild were written without the key at all, and
    the import side treats "missing" as "no restriction"; emitting an empty
    list could trip importers that distinguish the two states.
    """
    from superset.commands.dashboard.export import ExportDashboardsCommand

    mock_dashboard = _make_mock_dashboard({"native_filter_configuration": []})
    mock_dashboard.roles = []

    with patch(
        "superset.commands.dashboard.export.feature_flag_manager.is_feature_enabled",
        return_value=False,
    ):
        content = ExportDashboardsCommand._file_content(mock_dashboard)

    result = yaml.safe_load(content)
    # Strict: the key must be absent (not an empty list). The import side
    # treats "missing" as "no restriction"; emitting an empty list could
    # trip importers that distinguish the two states.
    assert "roles" not in result


def test_position_json_chart_id_leaks_env_local_integers():
    """
    Regression for #32972: dashboard export must produce stable output that does
    not vary with env-local integer chartIds.

    The export format includes a ``meta.chartId`` field inside each ``CHART-*``
    position entry. That integer is the database auto-increment primary key from
    the source environment. When the bundle is imported into a different
    environment the importer (``update_id_refs``) rewrites those IDs to the
    destination-env primary keys. A second export from the destination then
    serializes the new env-local integers — the same logical chart produces
    different ``chartId`` values in each environment.

    This test asserts that two exports of the same logical dashboard are
    identical even when the underlying chart has a different integer primary key
    in each environment. ``meta.uuid`` is the stable identifier that should be
    used instead of ``meta.chartId``.

    Fix target: ``superset/commands/dashboard/export.py`` (``append_charts``
    and ``_file_content``) — strip or UUID-replace ``chartId`` so the export
    format is environment-independent.
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
    src_dashboard.roles = []
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
    dest_dashboard.roles = []
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
    # THE REGRESSION: chartId must be stable (or absent) across envs.    #
    #                                                                     #
    # With the current (broken) implementation both assertions below      #
    # fail:                                                               #
    #   - first export emits chartId 392 (source-env integer)            #
    #   - second export emits chartId 1001 (destination-env integer)     #
    # The fix should either omit chartId entirely or derive it from the  #
    # UUID so that both exports agree.                                    #
    # ------------------------------------------------------------------ #
    first_chart_id = first_chart_meta.get("chartId")
    second_chart_id = second_chart_meta.get("chartId")

    assert first_chart_id == second_chart_id, (
        f"meta.chartId must be stable across environments, but the source-env "
        f"export produced chartId={first_chart_id!r} while the destination-env "
        f"export (after re-import with remapped IDs) produced "
        f"chartId={second_chart_id!r}. "
        "Env-local integer IDs are leaking into the export format (issue #32972). "
        "The fix: strip chartId from exported position_json or replace it with a "
        "value derived from meta.uuid so the export is environment-independent."
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
    dashboard.roles = []
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


def test_stabilize_chart_ids_skips_invalid_uuid():
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


def test_stabilize_chart_ids_remaps_native_filter_scope():
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


def test_stabilize_chart_ids_remaps_cross_filter_configuration():
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


def test_file_content_missing_dataset_preserves_dataset_id():
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
