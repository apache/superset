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

import importlib
import json
import logging
from pathlib import Path
from unittest import mock
from zipfile import is_zipfile, ZipFile

import pytest
import yaml
from freezegun import freeze_time

import superset.cli.importexport
from superset import app
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)

logger = logging.getLogger(__name__)


def assert_cli_fails_properly(response, caplog):
    """
    Ensure that a CLI command fails according to a predefined behaviour.
    """
    # don't exit successfully
    assert response.exit_code != 0

    # end the logs with a record on an error
    assert caplog.records[-1].levelname == "ERROR"


@mock.patch.dict(
    "superset.cli.lib.feature_flags", {"VERSIONED_EXPORT": False}, clear=True
)
@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
def test_export_dashboards_original(app_context, fs):
    """
    Test that a JSON file is exported.
    """
    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    # reload to define export_dashboards correctly based on the
    # feature flags
    importlib.reload(superset.cli.importexport)

    runner = app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.export_dashboards, ("-f", "dashboards.json")
    )

    assert response.exit_code == 0
    assert Path("dashboards.json").exists()

    # check that file is valid JSON
    with open("dashboards.json") as fp:
        contents = fp.read()
    json.loads(contents)


@mock.patch.dict(
    "superset.cli.lib.feature_flags", {"VERSIONED_EXPORT": False}, clear=True
)
@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
def test_export_datasources_original(app_context, fs):
    """
    Test that a YAML file is exported.
    """
    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    # reload to define export_dashboards correctly based on the
    # feature flags
    importlib.reload(superset.cli.importexport)

    runner = app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.export_datasources, ("-f", "datasources.yaml")
    )

    assert response.exit_code == 0

    assert Path("datasources.yaml").exists()

    # check that file is valid JSON
    with open("datasources.yaml") as fp:
        contents = fp.read()
    yaml.safe_load(contents)


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
@mock.patch.dict(
    "superset.cli.lib.feature_flags", {"VERSIONED_EXPORT": True}, clear=True
)
def test_export_dashboards_versioned_export(app_context, fs):
    """
    Test that a ZIP file is exported.
    """
    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    # reload to define export_dashboards correctly based on the
    # feature flags
    importlib.reload(superset.cli.importexport)

    runner = app.test_cli_runner()
    with freeze_time("2021-01-01T00:00:00Z"):
        response = runner.invoke(superset.cli.importexport.export_dashboards, ())

    assert response.exit_code == 0
    assert Path("dashboard_export_20210101T000000.zip").exists()

    assert is_zipfile("dashboard_export_20210101T000000.zip")


@mock.patch.dict(
    "superset.cli.lib.feature_flags", {"VERSIONED_EXPORT": True}, clear=True
)
@mock.patch(
    "superset.dashboards.commands.export.ExportDashboardsCommand.run",
    side_effect=Exception(),
)
def test_failing_export_dashboards_versioned_export(
    export_dashboards_command, app_context, fs, caplog
):
    """
    Test that failing to export ZIP file is done elegantly.
    """
    caplog.set_level(logging.DEBUG)

    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    # reload to define export_dashboards correctly based on the
    # feature flags
    importlib.reload(superset.cli.importexport)

    runner = app.test_cli_runner()
    with freeze_time("2021-01-01T00:00:00Z"):
        response = runner.invoke(superset.cli.importexport.export_dashboards, ())

    assert_cli_fails_properly(response, caplog)


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
@mock.patch.dict(
    "superset.cli.lib.feature_flags", {"VERSIONED_EXPORT": True}, clear=True
)
def test_export_datasources_versioned_export(app_context, fs):
    """
    Test that a ZIP file is exported.
    """
    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    # reload to define export_dashboards correctly based on the
    # feature flags
    importlib.reload(superset.cli.importexport)

    runner = app.test_cli_runner()
    with freeze_time("2021-01-01T00:00:00Z"):
        response = runner.invoke(superset.cli.importexport.export_datasources, ())

    assert response.exit_code == 0
    assert Path("dataset_export_20210101T000000.zip").exists()

    assert is_zipfile("dataset_export_20210101T000000.zip")


@mock.patch.dict(
    "superset.cli.lib.feature_flags", {"VERSIONED_EXPORT": True}, clear=True
)
@mock.patch(
    "superset.dashboards.commands.export.ExportDatasetsCommand.run",
    side_effect=Exception(),
)
def test_failing_export_datasources_versioned_export(
    export_dashboards_command, app_context, fs, caplog
):
    """
    Test that failing to export ZIP file is done elegantly.
    """
    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    # reload to define export_dashboards correctly based on the
    # feature flags
    importlib.reload(superset.cli.importexport)

    runner = app.test_cli_runner()
    with freeze_time("2021-01-01T00:00:00Z"):
        response = runner.invoke(superset.cli.importexport.export_datasources, ())

    assert_cli_fails_properly(response, caplog)


@mock.patch.dict(
    "superset.cli.lib.feature_flags", {"VERSIONED_EXPORT": True}, clear=True
)
@mock.patch("superset.dashboards.commands.importers.dispatcher.ImportDashboardsCommand")
def test_import_dashboards_versioned_export(import_dashboards_command, app_context, fs):
    """
    Test that both ZIP and JSON can be imported.
    """
    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    # reload to define export_dashboards correctly based on the
    # feature flags
    importlib.reload(superset.cli.importexport)

    # write JSON file
    with open("dashboards.json", "w") as fp:
        fp.write('{"hello": "world"}')

    runner = app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_dashboards, ("-p", "dashboards.json")
    )

    assert response.exit_code == 0
    expected_contents = {"dashboards.json": '{"hello": "world"}'}
    import_dashboards_command.assert_called_with(expected_contents, overwrite=True)

    # write ZIP file
    with ZipFile("dashboards.zip", "w") as bundle:
        with bundle.open("dashboards/dashboard.yaml", "w") as fp:
            fp.write(b"hello: world")

    runner = app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_dashboards, ("-p", "dashboards.zip")
    )

    assert response.exit_code == 0
    expected_contents = {"dashboard.yaml": "hello: world"}
    import_dashboards_command.assert_called_with(expected_contents, overwrite=True)


@mock.patch.dict(
    "superset.cli.lib.feature_flags", {"VERSIONED_EXPORT": True}, clear=True
)
@mock.patch(
    "superset.dashboards.commands.importers.dispatcher.ImportDashboardsCommand.run",
    side_effect=Exception(),
)
def test_failing_import_dashboards_versioned_export(
    import_dashboards_command, app_context, fs, caplog
):
    """
    Test that failing to import either ZIP and JSON is done elegantly.
    """
    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    # reload to define export_dashboards correctly based on the
    # feature flags
    importlib.reload(superset.cli.importexport)

    # write JSON file
    with open("dashboards.json", "w") as fp:
        fp.write('{"hello": "world"}')

    runner = app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_dashboards, ("-p", "dashboards.json")
    )

    assert_cli_fails_properly(response, caplog)

    # write ZIP file
    with ZipFile("dashboards.zip", "w") as bundle:
        with bundle.open("dashboards/dashboard.yaml", "w") as fp:
            fp.write(b"hello: world")

    runner = app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_dashboards, ("-p", "dashboards.zip")
    )

    assert_cli_fails_properly(response, caplog)


@mock.patch.dict(
    "superset.cli.lib.feature_flags", {"VERSIONED_EXPORT": True}, clear=True
)
@mock.patch("superset.datasets.commands.importers.dispatcher.ImportDatasetsCommand")
def test_import_datasets_versioned_export(import_datasets_command, app_context, fs):
    """
    Test that both ZIP and YAML can be imported.
    """
    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    # reload to define export_datasets correctly based on the
    # feature flags
    importlib.reload(superset.cli.importexport)

    # write YAML file
    with open("datasets.yaml", "w") as fp:
        fp.write("hello: world")

    runner = app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_datasources, ("-p", "datasets.yaml")
    )

    assert response.exit_code == 0
    expected_contents = {"datasets.yaml": "hello: world"}
    import_datasets_command.assert_called_with(expected_contents, overwrite=True)

    # write ZIP file
    with ZipFile("datasets.zip", "w") as bundle:
        with bundle.open("datasets/dataset.yaml", "w") as fp:
            fp.write(b"hello: world")

    runner = app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_datasources, ("-p", "datasets.zip")
    )

    assert response.exit_code == 0
    expected_contents = {"dataset.yaml": "hello: world"}
    import_datasets_command.assert_called_with(expected_contents, overwrite=True)


@mock.patch.dict(
    "superset.cli.lib.feature_flags", {"VERSIONED_EXPORT": False}, clear=True
)
@mock.patch("superset.datasets.commands.importers.v0.ImportDatasetsCommand")
def test_import_datasets_sync_argument_columns_metrics(
    import_datasets_command, app_context, fs
):
    """
    Test that the --sync command line argument syncs dataset in superset
    with YAML file. Using both columns and metrics with the --sync flag
    """
    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    # reload to define export_datasets correctly based on the
    # feature flags
    importlib.reload(superset.cli.importexport)

    # write YAML file
    with open("dataset.yaml", "w") as fp:
        fp.write("hello: world")

    runner = app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_datasources,
        ["-p", "dataset.yaml", "-s", "metrics,columns"],
    )

    assert response.exit_code == 0
    expected_contents = {"dataset.yaml": "hello: world"}
    import_datasets_command.assert_called_with(
        expected_contents, sync_columns=True, sync_metrics=True,
    )


@mock.patch.dict(
    "superset.cli.lib.feature_flags", {"VERSIONED_EXPORT": False}, clear=True
)
@mock.patch("superset.datasets.commands.importers.v0.ImportDatasetsCommand")
def test_import_datasets_sync_argument_columns(
    import_datasets_command, app_context, fs
):
    """
    Test that the --sync command line argument syncs dataset in superset
    with YAML file. Using only columns with the --sync flag
    """
    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    # reload to define export_datasets correctly based on the
    # feature flags
    importlib.reload(superset.cli.importexport)

    # write YAML file
    with open("dataset.yaml", "w") as fp:
        fp.write("hello: world")

    runner = app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_datasources,
        ["-p", "dataset.yaml", "-s", "columns"],
    )

    assert response.exit_code == 0
    expected_contents = {"dataset.yaml": "hello: world"}
    import_datasets_command.assert_called_with(
        expected_contents, sync_columns=True, sync_metrics=False,
    )


@mock.patch.dict(
    "superset.cli.lib.feature_flags", {"VERSIONED_EXPORT": False}, clear=True
)
@mock.patch("superset.datasets.commands.importers.v0.ImportDatasetsCommand")
def test_import_datasets_sync_argument_metrics(
    import_datasets_command, app_context, fs
):
    """
    Test that the --sync command line argument syncs dataset in superset
    with YAML file. Using only metrics with the --sync flag
    """
    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    # reload to define export_datasets correctly based on the
    # feature flags
    importlib.reload(superset.cli.importexport)

    # write YAML file
    with open("dataset.yaml", "w") as fp:
        fp.write("hello: world")

    runner = app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_datasources,
        ["-p", "dataset.yaml", "-s", "metrics"],
    )

    assert response.exit_code == 0
    expected_contents = {"dataset.yaml": "hello: world"}
    import_datasets_command.assert_called_with(
        expected_contents, sync_columns=False, sync_metrics=True,
    )


@mock.patch.dict(
    "superset.cli.lib.feature_flags", {"VERSIONED_EXPORT": True}, clear=True
)
@mock.patch(
    "superset.datasets.commands.importers.dispatcher.ImportDatasetsCommand.run",
    side_effect=Exception(),
)
def test_failing_import_datasets_versioned_export(
    import_datasets_command, app_context, fs, caplog
):
    """
    Test that failing to import either ZIP or YAML is done elegantly.
    """
    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    # reload to define export_datasets correctly based on the
    # feature flags
    importlib.reload(superset.cli.importexport)

    # write YAML file
    with open("datasets.yaml", "w") as fp:
        fp.write("hello: world")

    runner = app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_datasources, ("-p", "datasets.yaml")
    )

    assert_cli_fails_properly(response, caplog)

    # write ZIP file
    with ZipFile("datasets.zip", "w") as bundle:
        with bundle.open("datasets/dataset.yaml", "w") as fp:
            fp.write(b"hello: world")

    runner = app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_datasources, ("-p", "datasets.zip")
    )

    assert_cli_fails_properly(response, caplog)
