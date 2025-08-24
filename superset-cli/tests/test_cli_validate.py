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

from unittest.mock import Mock, patch

import pytest
from superset_cli.cli import app, validate_npm


# Validate Command Tests
@pytest.mark.cli
def test_validate_command_success(cli_runner):
    """Test validate command succeeds when npm is available and valid."""
    with patch("superset_cli.cli.validate_npm") as mock_validate:
        result = cli_runner.invoke(app, ["validate"])

        assert result.exit_code == 0
        assert "✅ Validation successful" in result.output
        mock_validate.assert_called_once()


@pytest.mark.cli
def test_validate_command_calls_npm_validation(cli_runner):
    """Test that validate command calls the npm validation function."""
    with patch("superset_cli.cli.validate_npm") as mock_validate:
        cli_runner.invoke(app, ["validate"])
        mock_validate.assert_called_once()


# Validate NPM Function Tests
@pytest.mark.unit
@patch("shutil.which")
def test_validate_npm_fails_when_npm_not_on_path(mock_which):
    """Test validate_npm fails when npm is not on PATH."""
    mock_which.return_value = None

    with pytest.raises(SystemExit) as exc_info:
        validate_npm()

    assert exc_info.value.code == 1
    mock_which.assert_called_once_with("npm")


@pytest.mark.unit
@patch("shutil.which")
@patch("subprocess.run")
def test_validate_npm_fails_when_npm_command_fails(mock_run, mock_which):
    """Test validate_npm fails when npm -v command fails."""
    mock_which.return_value = "/usr/bin/npm"
    mock_run.return_value = Mock(returncode=1, stderr="Command failed")

    with pytest.raises(SystemExit) as exc_info:
        validate_npm()

    assert exc_info.value.code == 1


@pytest.mark.unit
@patch("shutil.which")
@patch("subprocess.run")
def test_validate_npm_fails_when_version_too_low(mock_run, mock_which):
    """Test validate_npm fails when npm version is below minimum."""
    mock_which.return_value = "/usr/bin/npm"
    mock_run.return_value = Mock(returncode=0, stdout="9.0.0\n", stderr="")

    with pytest.raises(SystemExit) as exc_info:
        validate_npm()

    assert exc_info.value.code == 1


@pytest.mark.unit
@pytest.mark.parametrize(
    "npm_version",
    [
        "10.8.2",  # Exact minimum version
        "11.0.0",  # Higher version
        "10.9.0-alpha.1",  # Pre-release version higher than minimum
    ],
)
@patch("shutil.which")
@patch("subprocess.run")
def test_validate_npm_succeeds_with_valid_versions(mock_run, mock_which, npm_version):
    """Test validate_npm succeeds when npm version is valid."""
    mock_which.return_value = "/usr/bin/npm"
    mock_run.return_value = Mock(returncode=0, stdout=f"{npm_version}\n", stderr="")

    # Should not raise SystemExit
    validate_npm()


@pytest.mark.unit
@pytest.mark.parametrize(
    "npm_version,should_pass",
    [
        ("10.8.2", True),  # Exact minimum version
        ("10.8.1", False),  # Slightly lower version
        ("10.9.0-alpha.1", True),  # Pre-release version higher than minimum
        ("9.9.9", False),  # Much lower version
        ("11.0.0", True),  # Much higher version
    ],
)
@patch("shutil.which")
@patch("subprocess.run")
def test_validate_npm_version_comparison_edge_cases(
    mock_run, mock_which, npm_version, should_pass
):
    """Test npm version comparison with edge cases."""
    mock_which.return_value = "/usr/bin/npm"
    mock_run.return_value = Mock(returncode=0, stdout=f"{npm_version}\n", stderr="")

    if should_pass:
        # Should not raise SystemExit
        validate_npm()
    else:
        with pytest.raises(SystemExit):
            validate_npm()


@pytest.mark.unit
@patch("shutil.which")
@patch("subprocess.run")
def test_validate_npm_handles_file_not_found_exception(mock_run, mock_which):
    """Test validate_npm handles FileNotFoundError gracefully."""
    mock_which.return_value = "/usr/bin/npm"
    mock_run.side_effect = FileNotFoundError("Test error")

    with pytest.raises(SystemExit) as exc_info:
        validate_npm()

    assert exc_info.value.code == 1


@pytest.mark.unit
@pytest.mark.parametrize(
    "exception_type",
    [
        OSError,
        PermissionError,
    ],
)
@patch("shutil.which")
@patch("subprocess.run")
def test_validate_npm_does_not_catch_other_subprocess_exceptions(
    mock_run, mock_which, exception_type
):
    """Test validate_npm does not catch OSError and PermissionError (they propagate up)."""
    mock_which.return_value = "/usr/bin/npm"
    mock_run.side_effect = exception_type("Test error")

    # These exceptions should propagate up, not be caught
    with pytest.raises(exception_type):
        validate_npm()


@pytest.mark.unit
@patch("shutil.which")
@patch("subprocess.run")
def test_validate_npm_with_malformed_version_output_raises_error(mock_run, mock_which):
    """Test validate_npm raises ValueError with malformed version output."""
    mock_which.return_value = "/usr/bin/npm"
    mock_run.return_value = Mock(returncode=0, stdout="not-a-version\n", stderr="")

    # semver.compare will raise ValueError for malformed version
    with pytest.raises(ValueError):
        validate_npm()


@pytest.mark.unit
@patch("shutil.which")
@patch("subprocess.run")
def test_validate_npm_with_empty_version_output_raises_error(mock_run, mock_which):
    """Test validate_npm raises ValueError with empty version output."""
    mock_which.return_value = "/usr/bin/npm"
    mock_run.return_value = Mock(returncode=0, stdout="", stderr="")

    # semver.compare will raise ValueError for empty version
    with pytest.raises(ValueError):
        validate_npm()
