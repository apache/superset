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
