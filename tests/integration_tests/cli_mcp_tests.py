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

import os
import tempfile
from pathlib import Path
from unittest import mock

import pytest
from flask import current_app

import superset.cli.mcp


class TestMcpCliRun:
    """Test mcp run command"""

    @mock.patch("superset.cli.mcp.run_server")
    def test_run_basic(self, mock_run_server, app_context):
        """Test basic run command"""
        runner = current_app.test_cli_runner()
        response = runner.invoke(superset.cli.mcp.run, [])

        assert response.exit_code == 0
        mock_run_server.assert_called_once_with(
            host="127.0.0.1", port=5008, debug=False
        )

    @mock.patch.dict(os.environ, {}, clear=False)
    @mock.patch("superset.cli.mcp.run_server")
    def test_run_with_options(self, mock_run_server, app_context):
        """Test run command with all options"""
        runner = current_app.test_cli_runner()
        response = runner.invoke(
            superset.cli.mcp.run,
            ["--host", "0.0.0.0", "--port", "9999", "--debug", "--sql-debug"],  # noqa: S104
        )

        assert response.exit_code == 0
        assert os.environ.get("SQLALCHEMY_DEBUG") == "1"
        assert "🔍 SQL Debug mode enabled" in response.output
        mock_run_server.assert_called_once_with(host="0.0.0.0", port=9999, debug=True)  # noqa: S104


class TestMcpCliSetup:
    """Test mcp setup command"""

    @pytest.fixture(autouse=True)
    def setup_teardown(self, tmp_path):
        """Set up and tear down test environment"""
        # Save original directory
        original_cwd = os.getcwd()
        # Change to temp directory for test
        os.chdir(tmp_path)
        yield
        # Restore original directory
        os.chdir(original_cwd)

    def _mock_user_import(self, query_count_return=1, query_count_side_effect=None):
        """Helper to create consistent User import mocking with proper cleanup"""

        def import_side_effect(name, *args, **kwargs):
            if name == "flask_appbuilder.security.sqla.models":
                mock_user_class = mock.MagicMock()
                if query_count_side_effect:
                    mock_user_class.query.count.side_effect = query_count_side_effect
                else:
                    mock_user_class.query.count.return_value = query_count_return
                mock_module = mock.MagicMock()
                mock_module.User = mock_user_class
                return mock_module
            # Call original import for all other modules
            return self._original_import(name, *args, **kwargs)

        # Store original import only once per test class instance
        if not hasattr(self, "_original_import"):
            self._original_import = __builtins__["__import__"]

        return mock.patch("builtins.__import__", side_effect=import_side_effect)

    @mock.patch("superset.cli.mcp.security_manager")
    @mock.patch("superset.cli.mcp._verify_superset_config")
    def test_setup_skip_all(self, mock_verify, mock_security, app_context):
        """Test setup with all skips"""
        with self._mock_user_import():
            mock_security.find_user.return_value = True

            runner = current_app.test_cli_runner()
            response = runner.invoke(
                superset.cli.mcp.setup, ["--skip-config", "--skip-examples"]
            )

            assert response.exit_code == 0
            assert "Database already initialized" in response.output
            assert "Admin user already exists" in response.output

    @mock.patch("superset.cli.mcp.security_manager")
    @mock.patch("superset.cli.mcp._verify_superset_config")
    @mock.patch("superset.cli.mcp._create_config_file")
    def test_setup_new_config(
        self, mock_create, mock_verify, mock_security, app_context
    ):
        """Test setup creating new config"""
        with self._mock_user_import():
            mock_security.find_user.return_value = True

            # Config file should not exist in temp directory
            config_path = Path("superset_config.py")
            assert not config_path.exists()

            runner = current_app.test_cli_runner()
            response = runner.invoke(superset.cli.mcp.setup, ["--skip-examples"])

            assert response.exit_code == 0
            mock_create.assert_called_once()

    @mock.patch("superset.cli.mcp.security_manager")
    @mock.patch("superset.cli.mcp._verify_superset_config")
    @mock.patch("superset.cli.mcp._update_config_file")
    def test_setup_existing_config_update(
        self, mock_update, mock_verify, mock_security, app_context
    ):
        """Test setup with existing config and user confirms update"""
        with self._mock_user_import():
            mock_security.find_user.return_value = True

            # Create existing config
            Path("superset_config.py").write_text("SECRET_KEY = 'existing'")

            runner = current_app.test_cli_runner()
            response = runner.invoke(
                superset.cli.mcp.setup, ["--skip-examples"], input="y\n"
            )

            assert response.exit_code == 0
            mock_update.assert_called_once()

    @mock.patch("superset.cli.mcp.security_manager")
    @mock.patch("superset.cli.mcp._verify_superset_config")
    def test_setup_existing_config_no_update(
        self, mock_verify, mock_security, app_context
    ):
        """Test setup with existing config and user declines update"""
        with self._mock_user_import():
            mock_security.find_user.return_value = True

            # Create existing config
            Path("superset_config.py").write_text("SECRET_KEY = 'existing'")

            runner = current_app.test_cli_runner()
            response = runner.invoke(
                superset.cli.mcp.setup, ["--skip-examples"], input="n\n"
            )

            assert response.exit_code == 0
            assert "Keeping existing configuration" in response.output

    def test_setup_database_error(self, app_context):
        """Test setup with database error"""
        with self._mock_user_import(
            query_count_side_effect=Exception("Database not ready")
        ):
            runner = current_app.test_cli_runner()
            response = runner.invoke(
                superset.cli.mcp.setup, ["--skip-config", "--skip-examples"]
            )

            assert response.exit_code == 1
            assert "Database not initialized: Database not ready" in response.output

    @mock.patch("click.confirm", return_value=True)
    @mock.patch("superset.cli.mcp._create_admin_user")
    @mock.patch("superset.cli.mcp._verify_superset_config")
    def test_setup_create_admin_user(
        self, mock_verify, mock_create_admin, mock_confirm, app_context
    ):
        """Test setup creating admin user"""
        with self._mock_user_import():
            # Create a proper MagicMock for security_manager
            mock_security = mock.MagicMock()
            mock_security.find_user.return_value = None

            with mock.patch("superset.cli.mcp.security_manager", mock_security):
                runner = current_app.test_cli_runner()
                response = runner.invoke(
                    superset.cli.mcp.setup, ["--skip-config", "--skip-examples"]
                )

                assert response.exit_code == 0
                mock_create_admin.assert_called_once()

    @mock.patch("superset.cli.mcp.security_manager")
    @mock.patch("superset.cli.mcp._verify_superset_config")
    @mock.patch("superset.cli.examples.load_examples")
    def test_setup_load_examples(
        self, mock_load, mock_verify, mock_security, app_context
    ):
        """Test setup loading examples"""
        with self._mock_user_import():
            mock_security.find_user.return_value = True

            runner = current_app.test_cli_runner()
            response = runner.invoke(
                superset.cli.mcp.setup, ["--skip-config"], input="y\n"
            )

            assert response.exit_code == 0
            mock_load.assert_called_once()
            assert "Example datasets loaded" in response.output

    @mock.patch("superset.cli.mcp.security_manager")
    @mock.patch("superset.cli.mcp._verify_superset_config")
    def test_setup_skip_examples(self, mock_verify, mock_security, app_context):
        """Test setup declining examples"""
        with self._mock_user_import():
            mock_security.find_user.return_value = True

            runner = current_app.test_cli_runner()
            response = runner.invoke(
                superset.cli.mcp.setup, ["--skip-config"], input="n\n"
            )

            assert response.exit_code == 0
            assert "Load example datasets?" in response.output

    @mock.patch("superset.cli.mcp.security_manager")
    @mock.patch("superset.cli.mcp._verify_superset_config")
    @mock.patch("superset.cli.mcp._create_config_file")
    def test_setup_force_overwrite(
        self, mock_create, mock_verify, mock_security, app_context
    ):
        """Test setup with force flag"""
        with self._mock_user_import():
            mock_security.find_user.return_value = True

            # Create existing config
            Path("superset_config.py").write_text("SECRET_KEY = 'existing'")

            runner = current_app.test_cli_runner()
            response = runner.invoke(
                superset.cli.mcp.setup, ["--force", "--skip-examples"]
            )

            assert response.exit_code == 0
            mock_create.assert_called_once()


class TestMcpConfigHelpers:
    """Test configuration helper functions"""

    def setup_method(self):
        """Set up test environment"""
        self.test_dir = tempfile.mkdtemp()
        self.original_cwd = os.getcwd()
        os.chdir(self.test_dir)

    def teardown_method(self):
        """Clean up test environment"""
        os.chdir(self.original_cwd)
        if hasattr(self, "test_dir") and os.path.exists(self.test_dir):
            import shutil

            shutil.rmtree(self.test_dir)

    def test_create_config_file_basic(self, tmp_path):
        """Test basic config file creation"""
        config_path = tmp_path / "test_config.py"

        superset.cli.mcp._create_config_file(config_path)

        content = config_path.read_text()
        assert "SECRET_KEY" in content
        assert "MCP_ADMIN_USERNAME = 'admin'" in content
        assert "SUPERSET_WEBSERVER_ADDRESS = 'http://localhost:9001'" in content

    def test_update_config_file_add_missing(self, tmp_path):
        """Test updating config file with missing settings"""
        config_path = tmp_path / "test_config.py"
        config_path.write_text("# Empty config")

        superset.cli.mcp._update_config_file(config_path)

        content = config_path.read_text()
        assert "SECRET_KEY" in content
        assert "MCP_ADMIN_USERNAME" in content
        assert "WEBDRIVER_BASEURL" in content

    @mock.patch("superset.cli.mcp.security_manager")
    @mock.patch("superset.utils.decorators.transaction")
    def test_create_admin_user_success(self, mock_transaction, mock_security):
        """Test successful admin user creation"""
        mock_user = mock.Mock()
        mock_security.add_user.return_value = mock_user
        mock_security.find_role.return_value = mock.Mock()

        # Mock the transaction decorator
        def transaction_decorator(func):
            def wrapper():
                return func()

            return wrapper

        mock_transaction.return_value = transaction_decorator

        superset.cli.mcp._create_admin_user()

        mock_security.add_user.assert_called_once()

    @mock.patch("superset.cli.mcp.security_manager", spec=False)
    @mock.patch("superset.utils.decorators.transaction")
    def test_create_admin_user_failure(self, mock_transaction, mock_security):
        """Test failed admin user creation"""
        mock_security.add_user.return_value = None
        mock_security.find_role.return_value = mock.Mock()

        # Mock the transaction decorator to pass through
        mock_transaction.return_value = lambda func: func

        # This test primarily verifies that the function handles failure gracefully
        # without throwing exceptions when add_user returns None
        superset.cli.mcp._create_admin_user()

        mock_security.add_user.assert_called_once()

    def test_check_csrf_issue_enabled(self, app_context):
        """Test CSRF check when enabled"""
        with mock.patch("superset.cli.mcp.current_app", spec=True) as mock_app:
            mock_app.config.get.return_value = True
            result = superset.cli.mcp._check_csrf_issue()
            assert result is True

    def test_check_csrf_issue_disabled(self, app_context):
        """Test CSRF check when disabled"""
        with mock.patch("superset.cli.mcp.current_app", spec=True) as mock_app:
            mock_app.config.get.return_value = False
            result = superset.cli.mcp._check_csrf_issue()
            assert result is False

    def test_check_csrf_issue_exception(self):
        """Test CSRF check with exception"""
        assert superset.cli.mcp._check_csrf_issue() is True

    def test_get_webserver_address_from_config(self):
        """Test extracting webserver address from config"""
        content = "SUPERSET_WEBSERVER_ADDRESS = 'http://example.com:9001'"
        result = superset.cli.mcp._get_webserver_address(content)
        assert result == "http://example.com:9001"

    def test_get_webserver_address_default(self):
        """Test default webserver address"""
        content = "OTHER_SETTING = 'value'"
        result = superset.cli.mcp._get_webserver_address(content)
        assert result == "http://localhost:9001"

    def test_check_config_settings(self):
        """Test config settings validation"""
        content = """
SECRET_KEY = 'test'
SUPERSET_WEBSERVER_ADDRESS = 'http://localhost:9001'
"""
        # This function prints output, so we just ensure it doesn't crash
        superset.cli.mcp._check_config_settings(content)

    @mock.patch("superset.cli.mcp.requests.get")
    def test_check_superset_running_success(self, mock_get):
        """Test checking Superset when running"""
        mock_response = mock.Mock()
        mock_response.status_code = 200
        mock_get.return_value = mock_response

        # This function prints output, so we just ensure it doesn't crash
        superset.cli.mcp._check_superset_running("http://localhost:9001")
        mock_get.assert_called_once_with("http://localhost:9001/health", timeout=2)

    @mock.patch("superset.cli.mcp.requests.get")
    def test_check_superset_running_wrong_status(self, mock_get):
        """Test checking Superset with wrong status code"""
        mock_response = mock.Mock()
        mock_response.status_code = 500
        mock_get.return_value = mock_response

        superset.cli.mcp._check_superset_running("http://localhost:9001")
        mock_get.assert_called_once_with("http://localhost:9001/health", timeout=2)

    @mock.patch("superset.cli.mcp.requests.get")
    def test_check_superset_running_connection_error(self, mock_get):
        """Test checking Superset with connection error"""
        mock_get.side_effect = superset.cli.mcp.requests.exceptions.ConnectionError(
            "Connection failed"
        )

        superset.cli.mcp._check_superset_running("http://localhost:9001")
        mock_get.assert_called_once_with("http://localhost:9001/health", timeout=2)

    @mock.patch("superset.cli.mcp.requests.get")
    def test_check_superset_running_general_exception(self, mock_get):
        """Test checking Superset with general exception"""
        mock_get.side_effect = Exception("Unknown error")

        superset.cli.mcp._check_superset_running("http://localhost:9001")
        mock_get.assert_called_once_with("http://localhost:9001/health", timeout=2)

    @mock.patch("superset.cli.mcp.Path")
    @mock.patch("superset.cli.mcp._check_superset_running")
    @mock.patch("superset.cli.mcp._get_webserver_address")
    @mock.patch("superset.cli.mcp._check_config_settings")
    def test_verify_superset_config_missing_file(
        self, mock_check_settings, mock_get_address, mock_check_running, mock_path
    ):
        """Test config verification with missing file"""
        mock_config_path = mock.Mock()
        mock_config_path.exists.return_value = False
        mock_path.return_value = mock_config_path

        superset.cli.mcp._verify_superset_config()

        mock_check_settings.assert_not_called()
        mock_get_address.assert_not_called()
        mock_check_running.assert_not_called()

    @mock.patch("superset.cli.mcp.Path")
    @mock.patch("superset.cli.mcp._check_superset_running")
    @mock.patch("superset.cli.mcp._get_webserver_address")
    @mock.patch("superset.cli.mcp._check_config_settings")
    def test_verify_superset_config_success(
        self, mock_check_settings, mock_get_address, mock_check_running, mock_path
    ):
        """Test successful config verification"""
        mock_config_path = mock.Mock()
        mock_config_path.exists.return_value = True
        mock_config_path.read_text.return_value = "SECRET_KEY = 'test'"
        mock_path.return_value = mock_config_path
        mock_get_address.return_value = "http://localhost:9001"

        superset.cli.mcp._verify_superset_config()

        mock_check_settings.assert_called_once_with("SECRET_KEY = 'test'")
        mock_get_address.assert_called_once_with("SECRET_KEY = 'test'")
        mock_check_running.assert_called_once_with("http://localhost:9001")
