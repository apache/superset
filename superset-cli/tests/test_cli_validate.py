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


@pytest.mark.cli
class TestValidateCommand:
    """Test suite for the validate command."""

    def test_validate_command_success(self, cli_runner):
        """Test validate command succeeds when npm is available and valid."""
        with patch("superset_cli.cli.validate_npm") as mock_validate:
            result = cli_runner.invoke(app, ["validate"])

            assert result.exit_code == 0
            assert "✅ Validation successful" in result.output
            mock_validate.assert_called_once()

    def test_validate_command_calls_npm_validation(self, cli_runner):
        """Test that validate command calls the npm validation function."""
        with patch("superset_cli.cli.validate_npm") as mock_validate:
            cli_runner.invoke(app, ["validate"])
            mock_validate.assert_called_once()


@pytest.mark.unit
class TestValidateNpmFunction:
    """Unit tests for the validate_npm function."""

    @patch("shutil.which")
    def test_validate_npm_fails_when_npm_not_on_path(self, mock_which, cli_runner):
        """Test validate_npm fails when npm is not on PATH."""
        mock_which.return_value = None

        with pytest.raises(SystemExit) as exc_info:
            validate_npm()

        assert exc_info.value.code == 1
        mock_which.assert_called_once_with("npm")

    @patch("shutil.which")
    @patch("subprocess.run")
    def test_validate_npm_fails_when_npm_command_fails(self, mock_run, mock_which):
        """Test validate_npm fails when npm -v command fails."""
        mock_which.return_value = "/usr/bin/npm"
        mock_run.return_value = Mock(returncode=1, stderr="Command failed")

        with pytest.raises(SystemExit) as exc_info:
            validate_npm()

        assert exc_info.value.code == 1

    @patch("shutil.which")
    @patch("subprocess.run")
    def test_validate_npm_fails_when_version_too_low(self, mock_run, mock_which):
        """Test validate_npm fails when npm version is below minimum."""
        mock_which.return_value = "/usr/bin/npm"
        mock_run.return_value = Mock(returncode=0, stdout="9.0.0\n", stderr="")

        with pytest.raises(SystemExit) as exc_info:
            validate_npm()

        assert exc_info.value.code == 1

    @patch("shutil.which")
    @patch("subprocess.run")
    def test_validate_npm_succeeds_with_valid_version(self, mock_run, mock_which):
        """Test validate_npm succeeds when npm version is valid."""
        mock_which.return_value = "/usr/bin/npm"
        mock_run.return_value = Mock(returncode=0, stdout="10.8.2\n", stderr="")

        # Should not raise SystemExit
        validate_npm()

    @patch("shutil.which")
    @patch("subprocess.run")
    def test_validate_npm_succeeds_with_higher_version(self, mock_run, mock_which):
        """Test validate_npm succeeds when npm version is higher than minimum."""
        mock_which.return_value = "/usr/bin/npm"
        mock_run.return_value = Mock(returncode=0, stdout="11.0.0\n", stderr="")

        # Should not raise SystemExit
        validate_npm()

    @patch("shutil.which")
    @patch("subprocess.run")
    def test_validate_npm_handles_subprocess_exception(self, mock_run, mock_which):
        """Test validate_npm handles FileNotFoundError gracefully."""
        mock_which.return_value = "/usr/bin/npm"
        mock_run.side_effect = FileNotFoundError()

        with pytest.raises(SystemExit) as exc_info:
            validate_npm()

        assert exc_info.value.code == 1

    @patch("shutil.which")
    @patch("subprocess.run")
    def test_validate_npm_version_comparison_edge_cases(self, mock_run, mock_which):
        """Test npm version comparison with edge cases."""
        mock_which.return_value = "/usr/bin/npm"

        # Test exact minimum version
        mock_run.return_value = Mock(returncode=0, stdout="10.8.2\n", stderr="")
        validate_npm()  # Should not raise

        # Test slightly lower version
        mock_run.return_value = Mock(returncode=0, stdout="10.8.1\n", stderr="")
        with pytest.raises(SystemExit):
            validate_npm()

        # Test pre-release version higher than minimum
        mock_run.return_value = Mock(returncode=0, stdout="10.9.0-alpha.1\n", stderr="")
        validate_npm()  # Should not raise
