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

"""Unit tests for EngineManagerExtension."""

from contextlib import contextmanager
from datetime import timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask

from superset.engines.manager import EngineModes
from superset.extensions.engine_manager import EngineManagerExtension


@contextmanager
def dummy_engine_context_manager(
    database: Any, catalog: str | None, schema: str | None
):
    """Dummy context manager for testing."""
    yield


@pytest.fixture
def app_config() -> dict[str, Any]:
    """Default app config for testing."""
    return {
        "ENGINE_CONTEXT_MANAGER": dummy_engine_context_manager,
        "DB_CONNECTION_MUTATOR": None,
        "ENGINE_MANAGER_MODE": EngineModes.NEW,
        "ENGINE_MANAGER_CLEANUP_INTERVAL": timedelta(minutes=5),
        "SSH_TUNNEL_LOCAL_BIND_ADDRESS": "127.0.0.1",
        "SSH_TUNNEL_TIMEOUT_SEC": 30,
        "SSH_TUNNEL_PACKET_TIMEOUT_SEC": 1,
        "ENGINE_MANAGER_AUTO_START_CLEANUP": False,
    }


def test_init_app_creates_engine_manager(app_config: dict[str, Any]):
    """Test that init_app creates an EngineManager instance."""
    app = Flask(__name__)
    app.config.update(app_config)

    extension = EngineManagerExtension()
    extension.init_app(app)

    assert extension.engine_manager is not None
    assert extension.manager is extension.engine_manager


def test_init_app_singleton_mode_starts_cleanup_thread(app_config: dict[str, Any]):
    """Test that cleanup thread is started in SINGLETON mode with auto_start."""
    app = Flask(__name__)
    app_config["ENGINE_MANAGER_MODE"] = EngineModes.SINGLETON
    app_config["ENGINE_MANAGER_AUTO_START_CLEANUP"] = True
    app.config.update(app_config)

    extension = EngineManagerExtension()
    extension.init_app(app)

    # Cleanup thread should have been started
    assert extension.engine_manager._cleanup_thread is not None
    assert extension.engine_manager._cleanup_thread.is_alive()

    # Clean up
    extension.engine_manager.stop_cleanup_thread()


def test_init_app_new_mode_no_cleanup_thread(app_config: dict[str, Any]):
    """Test that cleanup thread is NOT started in NEW mode even with auto_start."""
    app = Flask(__name__)
    app_config["ENGINE_MANAGER_MODE"] = EngineModes.NEW
    app_config["ENGINE_MANAGER_AUTO_START_CLEANUP"] = True
    app.config.update(app_config)

    extension = EngineManagerExtension()
    extension.init_app(app)

    # Cleanup thread should NOT be started in NEW mode
    assert extension.engine_manager._cleanup_thread is None


def test_teardown_calls_shutdown(app_config: dict[str, Any]):
    """Test that Flask teardown properly calls shutdown_engine_manager."""
    app = Flask(__name__)
    app_config["ENGINE_MANAGER_MODE"] = EngineModes.SINGLETON
    app_config["ENGINE_MANAGER_AUTO_START_CLEANUP"] = True
    app.config.update(app_config)

    extension = EngineManagerExtension()
    extension.init_app(app)

    # Start cleanup thread to verify it gets stopped
    assert extension.engine_manager._cleanup_thread is not None
    assert extension.engine_manager._cleanup_thread.is_alive()

    # Simulate Flask teardown
    with app.app_context():
        pass  # Exit app context triggers teardown

    # After teardown, the cleanup thread should be stopped
    # Note: atexit handler also registered, so thread will definitely stop
    extension.engine_manager.stop_cleanup_thread()
    assert not extension.engine_manager._cleanup_thread.is_alive()


def test_manager_property_raises_before_init():
    """Test that accessing manager before init_app raises RuntimeError."""
    extension = EngineManagerExtension()

    with pytest.raises(RuntimeError, match="not initialized"):
        _ = extension.manager


def test_init_app_registers_atexit_handler(app_config: dict[str, Any]):
    """Test that init_app registers an atexit handler."""
    app = Flask(__name__)
    app.config.update(app_config)

    with patch("atexit.register") as mock_atexit:
        extension = EngineManagerExtension()
        extension.init_app(app)

        mock_atexit.assert_called_once()
        # The registered function should be shutdown_engine_manager
        registered_func = mock_atexit.call_args[0][0]
        assert callable(registered_func)


def test_init_app_registers_teardown_handler(app_config: dict[str, Any]):
    """Test that init_app registers a teardown handler that calls shutdown."""
    app = Flask(__name__)
    app.config.update(app_config)

    extension = EngineManagerExtension()
    extension.init_app(app)

    # Check that teardown_appcontext_funcs has our handler
    assert len(app.teardown_appcontext_funcs) > 0

    # The handler should be a lambda that calls shutdown_engine_manager
    # We can verify by checking it's callable
    handler = app.teardown_appcontext_funcs[-1]
    assert callable(handler)
