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

from freezegun import freeze_time
from pytest_mock import MockerFixture


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
