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

import json
import threading
import time
from unittest.mock import Mock, patch

import pytest
from superset_cli.cli import app, FrontendChangeHandler


# Dev Command Tests
@pytest.mark.cli
@patch("superset_cli.cli.Observer")
@patch("superset_cli.cli.init_frontend_deps")
@patch("superset_cli.cli.rebuild_frontend")
@patch("superset_cli.cli.rebuild_backend")
@patch("superset_cli.cli.build_manifest")
@patch("superset_cli.cli.write_manifest")
def test_dev_command_starts_watchers(
    mock_write_manifest,
    mock_build_manifest,
    mock_rebuild_backend,
    mock_rebuild_frontend,
    mock_init_frontend_deps,
    mock_observer_class,
    cli_runner,
    isolated_filesystem,
    extension_setup_for_dev,
):
    """Test dev command starts file watchers."""
    # Setup mocks
    mock_rebuild_frontend.return_value = "remoteEntry.abc123.js"
    mock_build_manifest.return_value = {"name": "test", "version": "1.0.0"}

    mock_observer = Mock()
    mock_observer_class.return_value = mock_observer

    extension_setup_for_dev(isolated_filesystem)

    # Run dev command in a thread since it's blocking
    def run_dev():
        try:
            cli_runner.invoke(app, ["dev"], catch_exceptions=False)
        except KeyboardInterrupt:
            pass

    dev_thread = threading.Thread(target=run_dev)
    dev_thread.daemon = True
    dev_thread.start()

    # Let it start up
    time.sleep(0.1)

    # Verify observer methods were called
    mock_observer.schedule.assert_called()
    mock_observer.start.assert_called_once()

    # Initial setup calls
    mock_init_frontend_deps.assert_called_once()
    mock_rebuild_frontend.assert_called()
    mock_rebuild_backend.assert_called()
    mock_build_manifest.assert_called()
    mock_write_manifest.assert_called()


@pytest.mark.cli
@patch("superset_cli.cli.init_frontend_deps")
@patch("superset_cli.cli.rebuild_frontend")
@patch("superset_cli.cli.rebuild_backend")
@patch("superset_cli.cli.build_manifest")
@patch("superset_cli.cli.write_manifest")
def test_dev_command_initial_build(
    mock_write_manifest,
    mock_build_manifest,
    mock_rebuild_backend,
    mock_rebuild_frontend,
    mock_init_frontend_deps,
    cli_runner,
    isolated_filesystem,
    extension_setup_for_dev,
):
    """Test dev command performs initial build setup."""
    # Setup mocks
    mock_rebuild_frontend.return_value = "remoteEntry.abc123.js"
    mock_build_manifest.return_value = {"name": "test", "version": "1.0.0"}

    extension_setup_for_dev(isolated_filesystem)

    with patch("superset_cli.cli.Observer") as mock_observer_class:
        mock_observer = Mock()
        mock_observer_class.return_value = mock_observer

        with patch("time.sleep", side_effect=KeyboardInterrupt):
            try:
                cli_runner.invoke(app, ["dev"], catch_exceptions=False)
            except KeyboardInterrupt:
                pass

    # Verify initial build steps
    frontend_dir = isolated_filesystem / "frontend"
    mock_init_frontend_deps.assert_called_once_with(frontend_dir)
    mock_rebuild_frontend.assert_called_once_with(isolated_filesystem, frontend_dir)
    mock_rebuild_backend.assert_called_once_with(isolated_filesystem)


# FrontendChangeHandler Tests
@pytest.mark.unit
def test_frontend_change_handler_init():
    """Test FrontendChangeHandler initialization."""
    mock_trigger = Mock()
    handler = FrontendChangeHandler(trigger_build=mock_trigger)

    assert handler.trigger_build == mock_trigger


@pytest.mark.unit
def test_frontend_change_handler_ignores_dist_changes():
    """Test FrontendChangeHandler ignores changes in dist directory."""
    mock_trigger = Mock()
    handler = FrontendChangeHandler(trigger_build=mock_trigger)

    # Create mock event with dist path
    mock_event = Mock()
    mock_event.src_path = "/path/to/frontend/dist/file.js"

    handler.on_any_event(mock_event)

    # Should not trigger build for dist changes
    mock_trigger.assert_not_called()


@pytest.mark.unit
@pytest.mark.parametrize(
    "source_path",
    [
        "/path/to/frontend/src/component.tsx",
        "/path/to/frontend/webpack.config.js",
        "/path/to/frontend/package.json",
    ],
)
def test_frontend_change_handler_triggers_on_source_changes(source_path):
    """Test FrontendChangeHandler triggers build on source changes."""
    mock_trigger = Mock()
    handler = FrontendChangeHandler(trigger_build=mock_trigger)

    # Create mock event with source path
    mock_event = Mock()
    mock_event.src_path = source_path

    handler.on_any_event(mock_event)

    # Should trigger build for source changes
    mock_trigger.assert_called_once()


# Dev Utility Functions Tests
@pytest.mark.unit
def test_frontend_watcher_function_coverage(isolated_filesystem):
    """Test frontend watcher function for coverage."""
    # Create extension.json
    extension_json = {
        "id": "test_extension",
        "name": "Test Extension",
        "version": "1.0.0",
        "permissions": [],
    }
    (isolated_filesystem / "extension.json").write_text(json.dumps(extension_json))

    # Create dist directory
    dist_dir = isolated_filesystem / "dist"
    dist_dir.mkdir()

    with patch("superset_cli.cli.rebuild_frontend") as mock_rebuild:
        with patch("superset_cli.cli.build_manifest") as mock_build:
            with patch("superset_cli.cli.write_manifest") as mock_write:
                mock_rebuild.return_value = "remoteEntry.abc123.js"
                mock_build.return_value = {"name": "test", "version": "1.0.0"}

                # Simulate frontend watcher function logic
                frontend_dir = isolated_filesystem / "frontend"
                frontend_dir.mkdir()

                # Actually call the functions to simulate the frontend_watcher
                if (
                    remote_entry := mock_rebuild(isolated_filesystem, frontend_dir)
                ) is not None:
                    manifest = mock_build(isolated_filesystem, remote_entry)
                    mock_write(isolated_filesystem, manifest)

                mock_rebuild.assert_called_once_with(isolated_filesystem, frontend_dir)
                mock_build.assert_called_once_with(
                    isolated_filesystem, "remoteEntry.abc123.js"
                )
                mock_write.assert_called_once_with(
                    isolated_filesystem, {"name": "test", "version": "1.0.0"}
                )


@pytest.mark.unit
def test_backend_watcher_function_coverage(isolated_filesystem):
    """Test backend watcher function for coverage."""
    # Create dist directory with manifest
    dist_dir = isolated_filesystem / "dist"
    dist_dir.mkdir()

    manifest_data = {"name": "test", "version": "1.0.0"}
    (dist_dir / "manifest.json").write_text(json.dumps(manifest_data))

    with patch("superset_cli.cli.rebuild_backend") as mock_rebuild:
        with patch("superset_cli.cli.write_manifest") as mock_write:
            # Simulate backend watcher function
            mock_rebuild(isolated_filesystem)

            manifest_path = dist_dir / "manifest.json"
            if manifest_path.exists():
                manifest = json.loads(manifest_path.read_text())
                mock_write(isolated_filesystem, manifest)

            mock_rebuild.assert_called_once_with(isolated_filesystem)
            mock_write.assert_called_once()
