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
import logging
from pathlib import Path
from typing import Any
from unittest import mock
from zipfile import is_zipfile, ZipFile

import pytest
import yaml  # noqa: F401
from flask import current_app, g
from flask.ctx import AppContext
from freezegun import freeze_time
from sqlalchemy_utils.types.encrypted.encrypted_type import AesGcmEngine

import superset.cli.importexport
import superset.cli.thumbnails
import superset.cli.update
import superset.utils.encrypt
from superset import db
from superset.models.dashboard import Dashboard
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
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


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
def test_export_dashboards_versioned_export(app_context, fs):
    """
    Test that a ZIP file is exported.
    """
    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    # reload to define export_dashboards correctly based on the
    # feature flags
    importlib.reload(superset.cli.importexport)

    runner = current_app.test_cli_runner()
    with freeze_time("2021-01-01T00:00:00Z"):
        response = runner.invoke(superset.cli.importexport.export_dashboards, ())

    assert response.exit_code == 0
    assert Path("dashboard_export_20210101T000000.zip").exists()

    assert is_zipfile("dashboard_export_20210101T000000.zip")


@mock.patch(
    "superset.commands.dashboard.export.ExportDashboardsCommand.run",
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

    runner = current_app.test_cli_runner()
    with freeze_time("2021-01-01T00:00:00Z"):
        response = runner.invoke(superset.cli.importexport.export_dashboards, ())

    assert_cli_fails_properly(response, caplog)


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
def test_export_datasources_versioned_export(app_context, fs):
    """
    Test that a ZIP file is exported.
    """
    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    # reload to define export_dashboards correctly based on the
    # feature flags
    importlib.reload(superset.cli.importexport)

    runner = current_app.test_cli_runner()
    with freeze_time("2021-01-01T00:00:00Z"):
        response = runner.invoke(superset.cli.importexport.export_datasources, ())

    assert response.exit_code == 0
    assert Path("dataset_export_20210101T000000.zip").exists()

    assert is_zipfile("dataset_export_20210101T000000.zip")


@mock.patch(
    "superset.commands.dashboard.export.ExportDatasetsCommand.run",
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

    runner = current_app.test_cli_runner()
    with freeze_time("2021-01-01T00:00:00Z"):
        response = runner.invoke(superset.cli.importexport.export_datasources, ())

    assert_cli_fails_properly(response, caplog)


@mock.patch("superset.commands.dashboard.importers.dispatcher.ImportDashboardsCommand")
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

    runner = current_app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_dashboards,
        ("-p", "dashboards.json", "-u", "admin"),
    )

    assert response.exit_code == 0
    expected_contents = {"dashboards.json": '{"hello": "world"}'}
    import_dashboards_command.assert_called_with(expected_contents, overwrite=True)

    # write ZIP file
    with ZipFile("dashboards.zip", "w") as bundle:
        with bundle.open("dashboards/dashboard.yaml", "w") as fp:
            fp.write(b"hello: world")

    runner = current_app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_dashboards,
        ("-p", "dashboards.zip", "-u", "admin"),
    )

    assert response.exit_code == 0
    expected_contents = {"dashboard.yaml": "hello: world"}
    import_dashboards_command.assert_called_with(expected_contents, overwrite=True)


@mock.patch(
    "superset.commands.dashboard.importers.dispatcher.ImportDashboardsCommand.run",
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

    runner = current_app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_dashboards,
        ("-p", "dashboards.json", "-u", "admin"),
    )

    assert_cli_fails_properly(response, caplog)

    # write ZIP file
    with ZipFile("dashboards.zip", "w") as bundle:
        with bundle.open("dashboards/dashboard.yaml", "w") as fp:
            fp.write(b"hello: world")

    runner = current_app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_dashboards,
        ("-p", "dashboards.zip", "-u", "admin"),
    )

    assert_cli_fails_properly(response, caplog)


@mock.patch("superset.commands.dataset.importers.dispatcher.ImportDatasetsCommand")
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

    runner = current_app.test_cli_runner()
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

    runner = current_app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_datasources, ("-p", "datasets.zip")
    )

    assert response.exit_code == 0
    expected_contents = {"dataset.yaml": "hello: world"}
    import_datasets_command.assert_called_with(expected_contents, overwrite=True)


@mock.patch(
    "superset.commands.dataset.importers.dispatcher.ImportDatasetsCommand.run",
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

    runner = current_app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_datasources, ("-p", "datasets.yaml")
    )

    assert_cli_fails_properly(response, caplog)

    # write ZIP file
    with ZipFile("datasets.zip", "w") as bundle:
        with bundle.open("datasets/dataset.yaml", "w") as fp:
            fp.write(b"hello: world")

    runner = current_app.test_cli_runner()
    response = runner.invoke(
        superset.cli.importexport.import_datasources, ("-p", "datasets.zip")
    )

    assert_cli_fails_properly(response, caplog)


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
@mock.patch("superset.tasks.thumbnails.cache_dashboard_thumbnail")
def test_compute_thumbnails(thumbnail_mock, app_context, fs):
    thumbnail_mock.return_value = None
    runner = current_app.test_cli_runner()
    dashboard = db.session.query(Dashboard).filter_by(slug="births").first()
    response = runner.invoke(
        superset.cli.thumbnails.compute_thumbnails,
        ["-d", "-i", dashboard.id],
    )

    thumbnail_mock.assert_called_with(None, dashboard.id, force=False)
    assert response.exit_code == 0


def test_re_encrypt_secrets_without_previous_key_is_noop(app_context):
    """
    When neither --previous_secret_key nor config.PREVIOUS_SECRET_KEY is set,
    the command should exit cleanly (0) rather than error out, so that
    scheduled re-encryption runs don't start failing after a successful
    rotation is complete.
    """
    current_app.config.pop("PREVIOUS_SECRET_KEY", None)
    runner = current_app.test_cli_runner()
    with mock.patch.object(superset.cli.update.SecretsMigrator, "run") as run_mock:
        response = runner.invoke(superset.cli.update.re_encrypt_secrets, [])

    assert response.exit_code == 0
    assert "nothing to re-encrypt" in response.output.lower()
    run_mock.assert_not_called()


def test_re_encrypt_secrets_failure_exits_nonzero(app_context):
    """
    When re-encryption fails for any field, SecretsMigrator.run raises to
    trigger rollback. The CLI must surface that as a non-zero exit with a
    clear error message — not as an uncaught exception.
    """
    runner = current_app.test_cli_runner()
    with mock.patch.object(
        superset.cli.update.SecretsMigrator,
        "run",
        side_effect=Exception("Re-encryption failed for 2 value(s)"),
    ):
        response = runner.invoke(
            superset.cli.update.re_encrypt_secrets,
            ["--previous_secret_key", "old-key"],
        )

    assert response.exit_code == 1
    assert "Re-encryption failed" in response.output
    # The failure path must be handled by the CLI, not leaked as an
    # uncaught exception.
    assert response.exception is None or isinstance(response.exception, SystemExit)


def test_re_encrypt_secrets_engine_option_invokes_migrator(
    app_context: AppContext,
) -> None:
    """
    When --engine is provided, the CLI must resolve the engine name to the
    correct engine class and pass it to SecretsMigrator as target_engine.
    """
    current_app.config.pop("PREVIOUS_SECRET_KEY", None)
    runner = current_app.test_cli_runner()
    with mock.patch.object(
        superset.cli.update,
        "SecretsMigrator",
    ) as migrator_mock:
        migrator_mock.return_value.run.return_value = (
            superset.utils.encrypt.ReEncryptStats()
        )
        response = runner.invoke(
            superset.cli.update.re_encrypt_secrets,
            ["--engine", "aes-gcm"],
        )

    assert response.exit_code == 0
    call_kwargs = migrator_mock.call_args.kwargs
    assert call_kwargs.get("target_engine") is AesGcmEngine
    assert call_kwargs.get("previous_secret_key") is None


def test_re_encrypt_secrets_engine_option_case_insensitive(
    app_context: AppContext,
) -> None:
    """
    The --engine option must be case-insensitive per
    click.Choice(..., case_sensitive=False).
    """
    current_app.config.pop("PREVIOUS_SECRET_KEY", None)
    runner = current_app.test_cli_runner()
    with mock.patch.object(
        superset.cli.update,
        "SecretsMigrator",
    ) as migrator_mock:
        migrator_mock.return_value.run.return_value = (
            superset.utils.encrypt.ReEncryptStats()
        )
        response = runner.invoke(
            superset.cli.update.re_encrypt_secrets,
            ["--engine", "AES-GCM"],
        )

    assert response.exit_code == 0
    assert migrator_mock.call_args.kwargs.get("target_engine") is AesGcmEngine


def test_re_encrypt_secrets_combined_key_rotation_and_engine(
    app_context: AppContext,
) -> None:
    """
    --previous_secret_key and --engine combine in a single run: the migrator
    must receive both the previous key (for decryption) and the target engine
    (for re-encryption). This is the mode most likely to regress, since the
    single-option tests each pin only the other's variable.
    """
    current_app.config.pop("PREVIOUS_SECRET_KEY", None)
    runner = current_app.test_cli_runner()
    with mock.patch.object(
        superset.cli.update,
        "SecretsMigrator",
    ) as migrator_mock:
        migrator_mock.return_value.run.return_value = (
            superset.utils.encrypt.ReEncryptStats()
        )
        response = runner.invoke(
            superset.cli.update.re_encrypt_secrets,
            ["--previous_secret_key", "old-key", "--engine", "aes-gcm"],
        )

    assert response.exit_code == 0
    call_kwargs = migrator_mock.call_args.kwargs
    assert call_kwargs.get("target_engine") is AesGcmEngine
    assert call_kwargs.get("previous_secret_key") == "old-key"


def test_re_encrypt_secrets_engine_option_invalid_raises_usage(
    app_context: AppContext,
) -> None:
    """
    An unrecognized engine name must produce a click usage error, not a
    traceback or silent failure.
    """
    runner = current_app.test_cli_runner()
    response = runner.invoke(
        superset.cli.update.re_encrypt_secrets,
        ["--engine", "nonexistent-engine"],
    )

    assert response.exit_code != 0
    assert "Invalid value" in response.output or "Usage:" in response.output
    assert "aes" in response.output or "aes-gcm" in response.output


@mock.patch("superset.examples.utils.load_configs_from_directory")
def test_import_directory(
    load_configs_mock: mock.MagicMock,
    app_context: Any,
    fs: Any,
) -> None:
    """
    Test that import-directory calls load_configs_from_directory with the
    correct arguments and assigns assets to the specified user.
    """
    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    importlib.reload(superset.cli.importexport)

    fake_user = mock.MagicMock()
    fake_user.username = "admin"

    captured_user: list[Any] = []

    def capture_g_user(**kwargs: Any) -> None:
        """Capture g.user at call time to verify override_user is active."""
        captured_user.append(g.user)

    load_configs_mock.side_effect = capture_g_user

    fs.create_dir("/assets")
    fs.create_file("/assets/metadata.yaml", contents="version: 1.0.0\n")

    runner = current_app.test_cli_runner()
    with mock.patch.object(
        superset.cli.importexport, "security_manager"
    ) as security_manager_mock:
        security_manager_mock.find_user.return_value = fake_user
        response = runner.invoke(
            superset.cli.importexport.import_directory,
            ("/assets", "-u", "admin"),
        )

    assert response.exit_code == 0
    security_manager_mock.find_user.assert_called_once_with(username="admin")
    load_configs_mock.assert_called_once()
    call_kwargs = load_configs_mock.call_args
    assert str(call_kwargs.kwargs["root"]) == "/assets"
    assert call_kwargs.kwargs["overwrite"] is False
    assert call_kwargs.kwargs["force_data"] is False
    assert captured_user[0] is fake_user


def test_import_directory_unknown_user(
    app_context: Any,
    fs: Any,
) -> None:
    """
    Test that import-directory fails fast with a clear error when the
    specified user does not exist.
    """
    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    importlib.reload(superset.cli.importexport)

    fs.create_dir("/assets")
    fs.create_file("/assets/metadata.yaml", contents="version: 1.0.0\n")

    runner = current_app.test_cli_runner()
    with mock.patch.object(
        superset.cli.importexport, "security_manager"
    ) as security_manager_mock:
        security_manager_mock.find_user.return_value = None
        response = runner.invoke(
            superset.cli.importexport.import_directory,
            ("/assets", "-u", "nonexistent"),
        )

    assert response.exit_code != 0
    assert "nonexistent" in response.output


@mock.patch(
    "superset.examples.utils.load_configs_from_directory",
    side_effect=Exception("import failed"),
)
def test_failing_import_directory(
    load_configs_mock: mock.MagicMock,
    app_context: Any,
    fs: Any,
    caplog: Any,
) -> None:
    """
    Test that a failure in import-directory is handled gracefully.
    """
    # pylint: disable=reimported, redefined-outer-name
    import superset.cli.importexport  # noqa: F811

    importlib.reload(superset.cli.importexport)

    fake_user = mock.MagicMock()

    fs.create_dir("/assets")
    fs.create_file("/assets/metadata.yaml", contents="version: 1.0.0\n")

    runner = current_app.test_cli_runner()
    with mock.patch.object(
        superset.cli.importexport, "security_manager"
    ) as security_manager_mock:
        security_manager_mock.find_user.return_value = fake_user
        response = runner.invoke(
            superset.cli.importexport.import_directory,
            ("/assets", "-u", "admin"),
        )

    assert_cli_fails_properly(response, caplog)
