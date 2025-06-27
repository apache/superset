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
# pylint: disable=invalid-name, unused-argument, import-outside-toplevel

from unittest.mock import patch

import pytest
import yaml
from freezegun import freeze_time
from pytest_mock import MockerFixture

from superset.extensions import feature_flag_manager


def test_export_assets_command(mocker: MockerFixture) -> None:
    """
    Test that all assets are exported correctly.
    """
    from superset.commands.export.assets import ExportAssetsCommand

    ExportDatabasesCommand = mocker.patch(  # noqa: N806
        "superset.commands.export.assets.ExportDatabasesCommand"
    )
    ExportDatabasesCommand.return_value.run.return_value = [
        (
            "metadata.yaml",
            lambda: "version: 1.0.0\ntype: Database\ntimestamp: '2022-01-01T00:00:00+00:00'\n",  # noqa: E501
        ),
        ("databases/example.yaml", lambda: "<DATABASE CONTENTS>"),
    ]
    ExportDatasetsCommand = mocker.patch(  # noqa: N806
        "superset.commands.export.assets.ExportDatasetsCommand"
    )
    ExportDatasetsCommand.return_value.run.return_value = [
        (
            "metadata.yaml",
            lambda: "version: 1.0.0\ntype: Dataset\ntimestamp: '2022-01-01T00:00:00+00:00'\n",  # noqa: E501
        ),
        ("datasets/example/dataset.yaml", lambda: "<DATASET CONTENTS>"),
    ]
    ExportChartsCommand = mocker.patch(  # noqa: N806
        "superset.commands.export.assets.ExportChartsCommand"
    )
    ExportChartsCommand.return_value.run.return_value = [
        (
            "metadata.yaml",
            lambda: "version: 1.0.0\ntype: Slice\ntimestamp: '2022-01-01T00:00:00+00:00'\n",  # noqa: E501
        ),
        ("charts/pie.yaml", lambda: "<CHART CONTENTS>"),
    ]
    ExportDashboardsCommand = mocker.patch(  # noqa: N806
        "superset.commands.export.assets.ExportDashboardsCommand"
    )
    ExportDashboardsCommand.return_value.run.return_value = [
        (
            "metadata.yaml",
            lambda: "version: 1.0.0\ntype: Dashboard\ntimestamp: '2022-01-01T00:00:00+00:00'\n",  # noqa: E501
        ),
        ("dashboards/sales.yaml", lambda: "<DASHBOARD CONTENTS>"),
    ]
    ExportSavedQueriesCommand = mocker.patch(  # noqa: N806
        "superset.commands.export.assets.ExportSavedQueriesCommand"
    )
    ExportSavedQueriesCommand.return_value.run.return_value = [
        (
            "metadata.yaml",
            lambda: "version: 1.0.0\ntype: SavedQuery\ntimestamp: '2022-01-01T00:00:00+00:00'\n",  # noqa: E501
        ),
        ("queries/example/metric.yaml", lambda: "<SAVED QUERY CONTENTS>"),
    ]

    with freeze_time("2022-01-01T00:00:00Z"):
        command = ExportAssetsCommand()
        output = [(file[0], file[1]()) for file in list(command.run())]
    assert output == [
        (
            "metadata.yaml",
            "version: 1.0.0\ntype: assets\ntimestamp: '2022-01-01T00:00:00+00:00'\n",
        ),
        ("databases/example.yaml", "<DATABASE CONTENTS>"),
        ("datasets/example/dataset.yaml", "<DATASET CONTENTS>"),
        ("charts/pie.yaml", "<CHART CONTENTS>"),
        ("dashboards/sales.yaml", "<DASHBOARD CONTENTS>"),
        ("queries/example/metric.yaml", "<SAVED QUERY CONTENTS>"),
    ]


@pytest.fixture
def mock_export_tags_command_charts_dashboards(mocker):
    export_tags = mocker.patch("superset.commands.tag.export.ExportTagsCommand")

    def _mock_export(dashboard_ids=None, chart_ids=None):
        if not feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"):
            return iter([])
        return [
            (
                "tags.yaml",
                lambda: yaml.dump(
                    {
                        "tags": [
                            {
                                "tag_name": "tag_1",
                                "description": "Description for tag_1",
                            }
                        ]
                    },
                    sort_keys=False,
                ),
            ),
            ("charts/pie.yaml", lambda: "tag:\n- tag_1"),
        ]

    export_tags.return_value._export.side_effect = _mock_export
    return export_tags


def test_export_tags_with_charts_dashboards(
    mock_export_tags_command_charts_dashboards, mocker
):
    with patch.object(feature_flag_manager, "is_feature_enabled", return_value=True):
        command = mock_export_tags_command_charts_dashboards()
        result = list(command._export(chart_ids=[1]))

        file_name, file_content_func = result[0]
        file_content = file_content_func()
        assert file_name == "tags.yaml"
        payload = yaml.safe_load(file_content)
        assert payload["tags"] == [
            {"tag_name": "tag_1", "description": "Description for tag_1"}
        ]

        file_name, file_content_func = result[1]
        file_content = file_content_func()
        assert file_name == "charts/pie.yaml"
        assert file_content == "tag:\n- tag_1"

    with patch.object(feature_flag_manager, "is_feature_enabled", return_value=False):
        command = mock_export_tags_command_charts_dashboards()
        result = list(command._export(chart_ids=[1]))
        assert not any(file_name == "tags.yaml" for file_name, _ in result)
        assert all(
            file_content_func() != "tag:\n- tag_1" for _, file_content_func in result
        )
