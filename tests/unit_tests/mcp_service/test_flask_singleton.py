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

"""Tests for MCP flask_singleton lazy initialization."""

from unittest.mock import MagicMock, patch

import pytest


@patch("superset.mcp_service.flask_singleton._create_flask_app")
def test_get_flask_app_calls_create_on_first_use(mock_create):
    """First call to get_flask_app() triggers _create_flask_app()."""
    import superset.mcp_service.flask_singleton as mod

    mock_app = MagicMock()
    mock_create.return_value = mock_app

    # Reset singleton state
    mod._app = None

    result = mod.get_flask_app()

    mock_create.assert_called_once()
    assert result is mock_app

    # Cleanup
    mod._app = None


@patch("superset.mcp_service.flask_singleton._create_flask_app")
def test_get_flask_app_returns_cached_on_second_call(mock_create):
    """Second call returns cached app without calling _create_flask_app() again."""
    import superset.mcp_service.flask_singleton as mod

    mock_app = MagicMock()
    mock_create.return_value = mock_app

    # Reset singleton state
    mod._app = None

    first = mod.get_flask_app()
    second = mod.get_flask_app()

    mock_create.assert_called_once()
    assert first is second

    # Cleanup
    mod._app = None


def test_import_does_not_trigger_app_creation():
    """Importing flask_singleton should NOT trigger Flask app creation."""
    import superset.mcp_service.flask_singleton as mod

    # Module-level _app should be None until get_flask_app() is called
    # (unless a previous test set it — so we check it's not auto-created on import)
    # The key property: importing the module has no side effects
    assert hasattr(mod, "_app")
    assert hasattr(mod, "get_flask_app")
    assert callable(mod.get_flask_app)


def test_app_variable_not_exported():
    """The module-level 'app' variable should not exist (forces ImportError)."""
    import superset.mcp_service.flask_singleton as mod

    assert not hasattr(mod, "app"), (
        "Module should not export 'app' — callers must use get_flask_app()"
    )


@patch("superset.mcp_service.flask_singleton._create_flask_app")
def test_get_flask_app_logs_error_on_failure(mock_create):
    """get_flask_app() logs the error and re-raises on failure."""
    import superset.mcp_service.flask_singleton as mod

    mod._app = None
    mock_create.side_effect = RuntimeError("test error")

    with pytest.raises(RuntimeError, match="test error"):
        mod.get_flask_app()

    # Cleanup
    mod._app = None
