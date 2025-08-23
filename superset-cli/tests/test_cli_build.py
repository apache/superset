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
from unittest.mock import Mock, patch

import pytest
from superset_cli.cli import (
    app,
    build_manifest,
    clean_dist,
    copy_backend_files,
    copy_frontend_dist,
    init_frontend_deps,
)

from tests.utils import (
    assert_directory_exists,
    assert_file_exists,
)


@pytest.fixture
def extension_with_build_structure():
    """Create extension structure suitable for build testing."""

    def _create(base_path, include_frontend=True, include_backend=True):
        # Create required directories
        if include_frontend:
            frontend_dir = base_path / "frontend"
            frontend_dir.mkdir()

        if include_backend:
            backend_dir = base_path / "backend"
            backend_dir.mkdir()

        # Create extension.json
        extension_json = {
            "id": "test_extension",
            "name": "Test Extension",
            "version": "1.0.0",
            "permissions": [],
        }

        if include_frontend:
            extension_json["frontend"] = {
                "contributions": {"commands": []},
                "moduleFederation": {"exposes": ["./index"]},
            }

        if include_backend:
            extension_json["backend"] = {"entryPoints": ["test_extension.entrypoint"]}

        (base_path / "extension.json").write_text(json.dumps(extension_json))

        return {
            "frontend_dir": frontend_dir if include_frontend else None,
            "backend_dir": backend_dir if include_backend else None,
        }

    return _create


# Build Command Tests
@pytest.mark.cli
@patch("superset_cli.cli.validate_npm")
@patch("superset_cli.cli.init_frontend_deps")
@patch("superset_cli.cli.rebuild_frontend")
@patch("superset_cli.cli.rebuild_backend")
@patch("superset_cli.cli.read_toml")
def test_build_command_success_flow(
    mock_read_toml,
    mock_rebuild_backend,
    mock_rebuild_frontend,
    mock_init_frontend_deps,
    mock_validate_npm,
    cli_runner,
    isolated_filesystem,
    extension_with_build_structure,
):
    """Test build command success flow."""
    # Setup mocks
    mock_rebuild_frontend.return_value = "remoteEntry.abc123.js"
    mock_read_toml.return_value = {"project": {"name": "test"}}

    # Create extension structure
    dirs = extension_with_build_structure(isolated_filesystem)

    result = cli_runner.invoke(app, ["build"])

    assert result.exit_code == 0
    assert "✅ Full build completed in dist/" in result.output

    # Verify function calls
    mock_validate_npm.assert_called_once()
    mock_init_frontend_deps.assert_called_once_with(dirs["frontend_dir"])
    mock_rebuild_frontend.assert_called_once()
    mock_rebuild_backend.assert_called_once()


@pytest.mark.cli
@patch("superset_cli.cli.validate_npm")
@patch("superset_cli.cli.init_frontend_deps")
@patch("superset_cli.cli.rebuild_frontend")
def test_build_command_handles_frontend_build_failure(
    mock_rebuild_frontend,
    mock_init_frontend_deps,
    mock_validate_npm,
    cli_runner,
    isolated_filesystem,
    extension_with_build_structure,
):
    """Test build command handles frontend build failure."""
    # Setup mocks
    mock_rebuild_frontend.return_value = None  # Indicates failure

    # Create extension structure
    extension_with_build_structure(isolated_filesystem)

    result = cli_runner.invoke(app, ["build"])

    # Command should complete and create manifest even with frontend failure
    assert result.exit_code == 0
    assert "✅ Full build completed in dist/" in result.output


# Clean Dist Tests
@pytest.mark.unit
def test_clean_dist_removes_existing_dist_directory(isolated_filesystem):
    """Test clean_dist removes existing dist directory and recreates it."""
    # Create dist directory with some content
    dist_dir = isolated_filesystem / "dist"
    dist_dir.mkdir()
    (dist_dir / "some_file.txt").write_text("test content")
    (dist_dir / "subdir").mkdir()

    clean_dist(isolated_filesystem)

    # Should exist but be empty
    assert_directory_exists(dist_dir)
    assert list(dist_dir.iterdir()) == []


@pytest.mark.unit
def test_clean_dist_creates_dist_directory_if_missing(isolated_filesystem):
    """Test clean_dist creates dist directory when it doesn't exist."""
    dist_dir = isolated_filesystem / "dist"
    assert not dist_dir.exists()

    clean_dist(isolated_filesystem)

    assert_directory_exists(dist_dir)


# Frontend Dependencies Tests
@pytest.mark.unit
@patch("subprocess.run")
def test_init_frontend_deps_skips_when_node_modules_exists(
    mock_run, isolated_filesystem
):
    """Test init_frontend_deps skips npm ci when node_modules exists."""
    frontend_dir = isolated_filesystem / "frontend"
    frontend_dir.mkdir()
    (frontend_dir / "node_modules").mkdir()

    init_frontend_deps(frontend_dir)

    # Should not call subprocess.run for npm ci
    mock_run.assert_not_called()


@pytest.mark.unit
@patch("subprocess.run")
@patch("superset_cli.cli.validate_npm")
def test_init_frontend_deps_runs_npm_i_when_missing(
    mock_validate_npm, mock_run, isolated_filesystem
):
    """Test init_frontend_deps runs npm ci when node_modules is missing."""
    frontend_dir = isolated_filesystem / "frontend"
    frontend_dir.mkdir()

    # Mock successful npm ci
    mock_run.return_value = Mock(returncode=0)

    init_frontend_deps(frontend_dir)

    # Should validate npm and run npm ci
    mock_validate_npm.assert_called_once()
    mock_run.assert_called_once_with(["npm", "i"], cwd=frontend_dir, text=True)


@pytest.mark.unit
@patch("subprocess.run")
@patch("superset_cli.cli.validate_npm")
def test_init_frontend_deps_exits_on_npm_ci_failure(
    mock_validate_npm, mock_run, isolated_filesystem
):
    """Test init_frontend_deps exits when npm ci fails."""
    frontend_dir = isolated_filesystem / "frontend"
    frontend_dir.mkdir()

    # Mock failed npm ci
    mock_run.return_value = Mock(returncode=1)

    with pytest.raises(SystemExit) as exc_info:
        init_frontend_deps(frontend_dir)

    assert exc_info.value.code == 1


# Build Manifest Tests
@pytest.mark.unit
def test_build_manifest_creates_correct_manifest_structure(isolated_filesystem):
    """Test build_manifest creates correct manifest from extension.json."""
    # Create extension.json
    extension_data = {
        "id": "test_extension",
        "name": "Test Extension",
        "version": "1.0.0",
        "permissions": ["read_data"],
        "dependencies": ["some_dep"],
        "frontend": {
            "contributions": {"commands": ["test_command"]},
            "moduleFederation": {"exposes": ["./index"]},
        },
        "backend": {"entryPoints": ["test_extension.entrypoint"]},
    }
    extension_json = isolated_filesystem / "extension.json"
    extension_json.write_text(json.dumps(extension_data))

    manifest = build_manifest(isolated_filesystem, "remoteEntry.abc123.js")

    # Verify manifest structure
    manifest_dict = dict(manifest)
    assert manifest_dict["id"] == "test_extension"
    assert manifest_dict["name"] == "Test Extension"
    assert manifest_dict["version"] == "1.0.0"
    assert manifest_dict["permissions"] == ["read_data"]
    assert manifest_dict["dependencies"] == ["some_dep"]

    # Verify frontend section
    assert "frontend" in manifest
    frontend = manifest["frontend"]
    assert frontend["contributions"] == {"commands": ["test_command"]}
    assert frontend["moduleFederation"] == {"exposes": ["./index"]}
    assert frontend["remoteEntry"] == "remoteEntry.abc123.js"

    # Verify backend section
    assert "backend" in manifest
    assert manifest["backend"]["entryPoints"] == ["test_extension.entrypoint"]


@pytest.mark.unit
def test_build_manifest_handles_minimal_extension(isolated_filesystem):
    """Test build_manifest with minimal extension.json (no frontend/backend)."""
    extension_data = {
        "id": "minimal_extension",
        "name": "Minimal Extension",
        "version": "0.1.0",
        "permissions": [],
    }
    extension_json = isolated_filesystem / "extension.json"
    extension_json.write_text(json.dumps(extension_data))

    manifest = build_manifest(isolated_filesystem, None)

    manifest_dict = dict(manifest)
    assert manifest_dict["id"] == "minimal_extension"
    assert manifest_dict["name"] == "Minimal Extension"
    assert manifest_dict["version"] == "0.1.0"
    assert manifest_dict["permissions"] == []
    assert manifest_dict["dependencies"] == []  # Default empty list
    assert "frontend" not in manifest
    assert "backend" not in manifest


@pytest.mark.unit
def test_build_manifest_exits_when_extension_json_missing(isolated_filesystem):
    """Test build_manifest exits when extension.json is missing."""
    with pytest.raises(SystemExit) as exc_info:
        build_manifest(isolated_filesystem, "remoteEntry.js")

    assert exc_info.value.code == 1


# Frontend Build Tests
@pytest.mark.unit
def test_clean_dist_frontend_removes_frontend_dist(isolated_filesystem):
    """Test clean_dist_frontend removes frontend/dist directory specifically."""
    from superset_cli.cli import clean_dist_frontend

    # Create dist/frontend structure
    dist_dir = isolated_filesystem / "dist"
    dist_dir.mkdir(parents=True)
    frontend_dist = dist_dir / "frontend"
    frontend_dist.mkdir()
    (frontend_dist / "some_file.js").write_text("content")

    clean_dist_frontend(isolated_filesystem)

    # Frontend dist should be removed, but dist should remain
    assert dist_dir.exists()
    assert not frontend_dist.exists()


@pytest.mark.unit
def test_clean_dist_frontend_handles_nonexistent_directory(isolated_filesystem):
    """Test clean_dist_frontend handles case where frontend dist doesn't exist."""
    from superset_cli.cli import clean_dist_frontend

    # No dist directory exists
    clean_dist_frontend(isolated_filesystem)

    # Should not raise error


@pytest.mark.unit
def test_run_frontend_build_with_output_messages(isolated_filesystem):
    """Test run_frontend_build produces expected output messages."""
    from superset_cli.cli import run_frontend_build

    frontend_dir = isolated_filesystem / "frontend"
    frontend_dir.mkdir()

    with patch("subprocess.run") as mock_run:
        mock_result = Mock(returncode=0)
        mock_run.return_value = mock_result

        result = run_frontend_build(frontend_dir)

        assert result.returncode == 0
        mock_run.assert_called_once_with(
            ["npm", "run", "build"], cwd=frontend_dir, text=True
        )


@pytest.mark.unit
@pytest.mark.parametrize(
    "return_code,expected_result",
    [
        (0, "remoteEntry.abc123.js"),
        (1, None),
    ],
)
def test_rebuild_frontend_handles_build_results(
    isolated_filesystem, return_code, expected_result
):
    """Test rebuild_frontend handles different build results."""
    from superset_cli.cli import rebuild_frontend

    # Create frontend structure
    frontend_dir = isolated_filesystem / "frontend"
    frontend_dir.mkdir()

    if return_code == 0:
        # Create frontend/dist with remoteEntry for success case
        frontend_dist = frontend_dir / "dist"
        frontend_dist.mkdir()
        (frontend_dist / "remoteEntry.abc123.js").write_text("content")

        # Create dist directory
        dist_dir = isolated_filesystem / "dist"
        dist_dir.mkdir()

    with patch("superset_cli.cli.run_frontend_build") as mock_build:
        mock_build.return_value = Mock(returncode=return_code)

        result = rebuild_frontend(isolated_filesystem, frontend_dir)

        assert result == expected_result


# Backend Build Tests
@pytest.mark.unit
def test_rebuild_backend_calls_copy_and_shows_message(isolated_filesystem):
    """Test rebuild_backend calls copy_backend_files and shows success message."""
    from superset_cli.cli import rebuild_backend

    # Create extension.json
    extension_json = {
        "id": "test",
        "name": "Test Extension",
        "version": "1.0.0",
        "permissions": [],
    }
    (isolated_filesystem / "extension.json").write_text(json.dumps(extension_json))

    with patch("superset_cli.cli.copy_backend_files") as mock_copy:
        rebuild_backend(isolated_filesystem)

        mock_copy.assert_called_once_with(isolated_filesystem)


@pytest.mark.unit
def test_copy_backend_files_skips_non_files(isolated_filesystem):
    """Test copy_backend_files skips directories and non-files."""
    # Create backend structure with directory
    backend_src = isolated_filesystem / "backend" / "src" / "test_ext"
    backend_src.mkdir(parents=True)
    (backend_src / "__init__.py").write_text("# init")

    # Create a subdirectory (should be skipped)
    subdir = backend_src / "subdir"
    subdir.mkdir()

    # Create extension.json with backend file patterns
    extension_data = {
        "id": "test_ext",
        "name": "Test Extension",
        "version": "1.0.0",
        "permissions": [],
        "backend": {
            "files": ["backend/src/test_ext/**/*"]  # Will match both files and dirs
        },
    }
    (isolated_filesystem / "extension.json").write_text(json.dumps(extension_data))

    # Create dist directory
    clean_dist(isolated_filesystem)

    copy_backend_files(isolated_filesystem)

    # Verify only files were copied, not directories
    dist_dir = isolated_filesystem / "dist"
    assert_file_exists(dist_dir / "backend" / "src" / "test_ext" / "__init__.py")

    # Directory should not be copied as a file
    copied_subdir = dist_dir / "backend" / "src" / "test_ext" / "subdir"
    # The directory might exist but should be empty since we skip non-files
    if copied_subdir.exists():
        assert list(copied_subdir.iterdir()) == []


@pytest.mark.unit
def test_copy_backend_files_copies_matched_files(isolated_filesystem):
    """Test copy_backend_files copies files matching patterns from extension.json."""
    # Create backend source files
    backend_src = isolated_filesystem / "backend" / "src" / "test_ext"
    backend_src.mkdir(parents=True)
    (backend_src / "__init__.py").write_text("# init")
    (backend_src / "main.py").write_text("# main")

    # Create extension.json with backend file patterns
    extension_data = {
        "id": "test_ext",
        "name": "Test Extension",
        "version": "1.0.0",
        "permissions": [],
        "backend": {"files": ["backend/src/test_ext/**/*.py"]},
    }
    (isolated_filesystem / "extension.json").write_text(json.dumps(extension_data))

    # Create dist directory
    clean_dist(isolated_filesystem)

    copy_backend_files(isolated_filesystem)

    # Verify files were copied
    dist_dir = isolated_filesystem / "dist"
    assert_file_exists(dist_dir / "backend" / "src" / "test_ext" / "__init__.py")
    assert_file_exists(dist_dir / "backend" / "src" / "test_ext" / "main.py")


@pytest.mark.unit
def test_copy_backend_files_handles_no_backend_config(isolated_filesystem):
    """Test copy_backend_files handles extension.json without backend config."""
    extension_data = {
        "id": "frontend_only",
        "name": "Frontend Only Extension",
        "version": "1.0.0",
        "permissions": [],
    }
    (isolated_filesystem / "extension.json").write_text(json.dumps(extension_data))

    clean_dist(isolated_filesystem)

    # Should not raise error
    copy_backend_files(isolated_filesystem)


@pytest.mark.unit
def test_copy_backend_files_exits_when_extension_json_missing(isolated_filesystem):
    """Test copy_backend_files exits when extension.json is missing."""
    clean_dist(isolated_filesystem)

    with pytest.raises(SystemExit) as exc_info:
        copy_backend_files(isolated_filesystem)

    assert exc_info.value.code == 1


# Frontend Dist Copy Tests
@pytest.mark.unit
def test_copy_frontend_dist_copies_files_correctly(isolated_filesystem):
    """Test copy_frontend_dist copies frontend build files to dist."""
    # Create frontend/dist structure
    frontend_dist = isolated_filesystem / "frontend" / "dist"
    frontend_dist.mkdir(parents=True)

    # Create some files including remoteEntry
    (frontend_dist / "remoteEntry.abc123.js").write_text("remote entry content")
    (frontend_dist / "main.js").write_text("main js content")

    # Create subdirectory with file
    assets_dir = frontend_dist / "assets"
    assets_dir.mkdir()
    (assets_dir / "style.css").write_text("css content")

    # Create dist directory
    clean_dist(isolated_filesystem)

    remote_entry = copy_frontend_dist(isolated_filesystem)

    assert remote_entry == "remoteEntry.abc123.js"

    # Verify files were copied
    dist_dir = isolated_filesystem / "dist"
    assert_file_exists(dist_dir / "frontend" / "dist" / "remoteEntry.abc123.js")
    assert_file_exists(dist_dir / "frontend" / "dist" / "main.js")
    assert_file_exists(dist_dir / "frontend" / "dist" / "assets" / "style.css")


@pytest.mark.unit
def test_copy_frontend_dist_exits_when_no_remote_entry(isolated_filesystem):
    """Test copy_frontend_dist exits when no remoteEntry file found."""
    # Create frontend/dist without remoteEntry file
    frontend_dist = isolated_filesystem / "frontend" / "dist"
    frontend_dist.mkdir(parents=True)
    (frontend_dist / "main.js").write_text("main content")

    clean_dist(isolated_filesystem)

    with pytest.raises(SystemExit) as exc_info:
        copy_frontend_dist(isolated_filesystem)

    assert exc_info.value.code == 1
