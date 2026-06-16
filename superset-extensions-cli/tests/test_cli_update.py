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

import pytest
from superset_extensions_cli.cli import app
from superset_extensions_cli.utils import read_json, read_toml


@pytest.mark.cli
def test_update_syncs_versions(
    cli_runner, isolated_filesystem, extension_with_versions
):
    """Test update syncs frontend and backend versions from extension.json."""
    extension_with_versions(
        isolated_filesystem,
        ext_version="2.0.0",
        frontend_version="1.0.0",
        backend_version="1.0.0",
    )

    result = cli_runner.invoke(app, ["update"])

    assert result.exit_code == 0
    assert "Updated frontend/package.json" in result.output
    assert "Updated backend/pyproject.toml" in result.output

    frontend_pkg = read_json(isolated_filesystem / "frontend" / "package.json")
    assert frontend_pkg["version"] == "2.0.0"

    backend_pyproject = read_toml(isolated_filesystem / "backend" / "pyproject.toml")
    assert backend_pyproject["project"]["version"] == "2.0.0"


@pytest.mark.cli
def test_update_noop_when_all_match(
    cli_runner, isolated_filesystem, extension_with_versions
):
    """Test update reports no changes when everything already matches."""
    extension_with_versions(
        isolated_filesystem,
        ext_version="1.0.0",
        frontend_version="1.0.0",
        backend_version="1.0.0",
    )

    result = cli_runner.invoke(app, ["update"])

    assert result.exit_code == 0
    assert "All files already up to date" in result.output


@pytest.mark.cli
def test_update_fails_without_extension_json(cli_runner, isolated_filesystem):
    """Test update fails when extension.json is missing."""
    result = cli_runner.invoke(app, ["update"])

    assert result.exit_code != 0
    assert "extension.json not found" in result.output


@pytest.mark.cli
def test_update_with_version_flag(
    cli_runner, isolated_filesystem, extension_with_versions
):
    """Test --version updates extension.json first, then syncs all files."""
    extension_with_versions(
        isolated_filesystem,
        ext_version="1.0.0",
        frontend_version="1.0.0",
        backend_version="1.0.0",
    )

    result = cli_runner.invoke(app, ["update", "--version", "3.0.0"])

    assert result.exit_code == 0
    assert "Updated extension.json" in result.output
    assert "Updated frontend/package.json" in result.output
    assert "Updated backend/pyproject.toml" in result.output

    ext = read_json(isolated_filesystem / "extension.json")
    assert ext["version"] == "3.0.0"

    frontend_pkg = read_json(isolated_filesystem / "frontend" / "package.json")
    assert frontend_pkg["version"] == "3.0.0"

    backend_pyproject = read_toml(isolated_filesystem / "backend" / "pyproject.toml")
    assert backend_pyproject["project"]["version"] == "3.0.0"


@pytest.mark.cli
def test_update_with_license_flag(
    cli_runner, isolated_filesystem, extension_with_versions
):
    """Test --license updates license across all files."""
    extension_with_versions(
        isolated_filesystem,
        ext_version="1.0.0",
        frontend_version="1.0.0",
        backend_version="1.0.0",
        ext_license="Apache-2.0",
    )

    result = cli_runner.invoke(app, ["update", "--license", "MIT"])

    assert result.exit_code == 0
    assert "Updated extension.json" in result.output
    assert "Updated frontend/package.json" in result.output
    assert "Updated backend/pyproject.toml" in result.output

    ext = read_json(isolated_filesystem / "extension.json")
    assert ext["license"] == "MIT"

    frontend_pkg = read_json(isolated_filesystem / "frontend" / "package.json")
    assert frontend_pkg["license"] == "MIT"

    backend_pyproject = read_toml(isolated_filesystem / "backend" / "pyproject.toml")
    assert backend_pyproject["project"]["license"] == "MIT"


@pytest.mark.cli
def test_update_version_prompt_default(
    cli_runner, isolated_filesystem, extension_with_versions
):
    """Test --version without value prompts with current version as default."""
    extension_with_versions(
        isolated_filesystem,
        ext_version="1.0.0",
        frontend_version="1.0.0",
        backend_version="1.0.0",
    )

    # Hit enter to accept default — nothing should change
    result = cli_runner.invoke(app, ["update", "--version"], input="\n")

    assert result.exit_code == 0
    assert "All files already up to date" in result.output


@pytest.mark.cli
def test_update_rejects_invalid_version(
    cli_runner, isolated_filesystem, extension_with_versions
):
    """Test --version with an invalid semver string exits with error."""
    extension_with_versions(
        isolated_filesystem,
        ext_version="1.0.0",
    )

    result = cli_runner.invoke(app, ["update", "--version", "not-a-version"])

    assert result.exit_code != 0
    assert "Invalid value" in result.output

    # Verify extension.json was not modified
    ext = read_json(isolated_filesystem / "extension.json")
    assert ext["version"] == "1.0.0"
