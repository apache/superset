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
import zipfile
from unittest.mock import patch

import pytest
from superset_cli.cli import app

from tests.utils import assert_file_exists


# Bundle Command Tests
@pytest.mark.cli
@patch("superset_cli.cli.build")
def test_bundle_command_creates_zip_with_default_name(
    mock_build, cli_runner, isolated_filesystem, extension_setup_for_bundling
):
    """Test bundle command creates zip file with default name."""
    # Mock the build command to do nothing (we'll set up dist manually)
    mock_build.return_value = None

    # Setup extension for bundling (this creates the dist structure)
    extension_setup_for_bundling(isolated_filesystem)

    result = cli_runner.invoke(app, ["bundle"])

    assert result.exit_code == 0
    assert "✅ Bundle created: test_extension-1.0.0.supx" in result.output

    # Verify zip file was created
    zip_path = isolated_filesystem / "test_extension-1.0.0.supx"
    assert_file_exists(zip_path)

    # Verify zip contents
    with zipfile.ZipFile(zip_path, "r") as zipf:
        file_list = zipf.namelist()
        assert "manifest.json" in file_list
        assert "frontend/dist/remoteEntry.abc123.js" in file_list
        assert "frontend/dist/main.js" in file_list
        assert "backend/src/test_extension/__init__.py" in file_list


@pytest.mark.cli
@patch("superset_cli.cli.build")
def test_bundle_command_with_custom_output_filename(
    mock_build, cli_runner, isolated_filesystem, extension_setup_for_bundling
):
    """Test bundle command with custom output filename."""
    # Mock the build command
    mock_build.return_value = None

    extension_setup_for_bundling(isolated_filesystem)

    custom_name = "my_custom_bundle.supx"
    result = cli_runner.invoke(app, ["bundle", "--output", custom_name])

    assert result.exit_code == 0
    assert f"✅ Bundle created: {custom_name}" in result.output

    # Verify custom-named zip file was created
    zip_path = isolated_filesystem / custom_name
    assert_file_exists(zip_path)


@pytest.mark.cli
@patch("superset_cli.cli.build")
def test_bundle_command_with_output_directory(
    mock_build, cli_runner, isolated_filesystem, extension_setup_for_bundling
):
    """Test bundle command with output directory."""
    # Mock the build command
    mock_build.return_value = None

    extension_setup_for_bundling(isolated_filesystem)

    # Create output directory
    output_dir = isolated_filesystem / "output"
    output_dir.mkdir()

    result = cli_runner.invoke(app, ["bundle", "--output", str(output_dir)])

    assert result.exit_code == 0

    # Verify zip file was created in output directory
    expected_path = output_dir / "test_extension-1.0.0.supx"
    assert_file_exists(expected_path)
    assert f"✅ Bundle created: {expected_path}" in result.output


@pytest.mark.cli
@patch("superset_cli.cli.build")
def test_bundle_command_fails_without_manifest(
    mock_build, cli_runner, isolated_filesystem
):
    """Test bundle command fails when manifest.json doesn't exist."""
    # Mock build to succeed but not create manifest
    mock_build.return_value = None

    # Create empty dist directory
    (isolated_filesystem / "dist").mkdir()

    result = cli_runner.invoke(app, ["bundle"])

    assert result.exit_code == 1
    assert "dist/manifest.json not found" in result.output


@pytest.mark.cli
@patch("superset_cli.cli.build")
def test_bundle_command_handles_zip_creation_error(
    mock_build, cli_runner, isolated_filesystem, extension_setup_for_bundling
):
    """Test bundle command handles zip file creation errors."""
    # Mock the build command
    mock_build.return_value = None

    extension_setup_for_bundling(isolated_filesystem)

    # Try to bundle to an invalid location (directory that doesn't exist)
    invalid_path = isolated_filesystem / "nonexistent" / "bundle.supx"

    with patch("zipfile.ZipFile", side_effect=OSError("Permission denied")):
        result = cli_runner.invoke(app, ["bundle", "--output", str(invalid_path)])

        assert result.exit_code == 1
        assert "Failed to create bundle" in result.output


@pytest.mark.cli
@patch("superset_cli.cli.build")
def test_bundle_includes_all_files_recursively(
    mock_build, cli_runner, isolated_filesystem
):
    """Test that bundle includes all files from dist directory recursively."""
    # Mock the build command
    mock_build.return_value = None

    # Create complex dist structure
    dist_dir = isolated_filesystem / "dist"
    dist_dir.mkdir(parents=True)

    # Manifest
    manifest = {
        "id": "complex_extension",
        "name": "Complex Extension",
        "version": "2.1.0",
        "permissions": [],
    }
    (dist_dir / "manifest.json").write_text(json.dumps(manifest))

    # Frontend files with nested structure
    frontend_dir = dist_dir / "frontend" / "dist"
    frontend_dir.mkdir(parents=True)
    (frontend_dir / "remoteEntry.xyz789.js").write_text("// entry")

    assets_dir = frontend_dir / "assets"
    assets_dir.mkdir()
    (assets_dir / "style.css").write_text("/* css */")
    (assets_dir / "image.png").write_bytes(b"fake image data")

    # Backend files with nested structure
    backend_dir = dist_dir / "backend" / "src" / "complex_extension"
    backend_dir.mkdir(parents=True)
    (backend_dir / "__init__.py").write_text("# init")
    (backend_dir / "core.py").write_text("# core")

    utils_dir = backend_dir / "utils"
    utils_dir.mkdir()
    (utils_dir / "helpers.py").write_text("# helpers")

    result = cli_runner.invoke(app, ["bundle"])

    assert result.exit_code == 0

    # Verify zip file and contents
    zip_path = isolated_filesystem / "complex_extension-2.1.0.supx"
    assert_file_exists(zip_path)

    with zipfile.ZipFile(zip_path, "r") as zipf:
        file_list = set(zipf.namelist())

        # Verify all files are included
        expected_files = {
            "manifest.json",
            "frontend/dist/remoteEntry.xyz789.js",
            "frontend/dist/assets/style.css",
            "frontend/dist/assets/image.png",
            "backend/src/complex_extension/__init__.py",
            "backend/src/complex_extension/core.py",
            "backend/src/complex_extension/utils/helpers.py",
        }

        assert expected_files.issubset(
            file_list
        ), f"Missing files: {expected_files - file_list}"


@pytest.mark.cli
@patch("superset_cli.cli.build")
def test_bundle_command_short_option(
    mock_build, cli_runner, isolated_filesystem, extension_setup_for_bundling
):
    """Test bundle command with short -o option."""
    # Mock the build command
    mock_build.return_value = None

    extension_setup_for_bundling(isolated_filesystem)

    result = cli_runner.invoke(app, ["bundle", "-o", "short_option.supx"])

    assert result.exit_code == 0
    assert "✅ Bundle created: short_option.supx" in result.output
    assert_file_exists(isolated_filesystem / "short_option.supx")


@pytest.mark.cli
@pytest.mark.parametrize("output_option", ["--output", "-o"])
@patch("superset_cli.cli.build")
def test_bundle_command_output_options(
    mock_build,
    output_option,
    cli_runner,
    isolated_filesystem,
    extension_setup_for_bundling,
):
    """Test bundle command with both long and short output options."""
    # Mock the build command
    mock_build.return_value = None

    extension_setup_for_bundling(isolated_filesystem)

    filename = f"test_{output_option.replace('-', '')}.supx"
    result = cli_runner.invoke(app, ["bundle", output_option, filename])

    assert result.exit_code == 0
    assert f"✅ Bundle created: {filename}" in result.output
    assert_file_exists(isolated_filesystem / filename)
