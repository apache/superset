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

"""Unit tests for EngineManager."""

import threading
from collections.abc import Iterator
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.pool import NullPool

from superset.engines.manager import _LockManager, EngineManager, EngineModes


class TestLockManager:
    """Test the _LockManager class."""

    def test_get_lock_creates_new_lock(self):
        """Test that get_lock creates a new lock when needed."""
        manager = _LockManager()
        lock1 = manager.get_lock("key1")

        assert isinstance(lock1, type(threading.RLock()))
        assert lock1 is manager.get_lock("key1")  # Same lock returned

    def test_get_lock_different_keys_different_locks(self):
        """Test that different keys get different locks."""
        manager = _LockManager()
        lock1 = manager.get_lock("key1")
        lock2 = manager.get_lock("key2")

        assert lock1 is not lock2

    def test_cleanup_removes_unused_locks(self):
        """Test that cleanup removes locks for inactive keys."""
        manager = _LockManager()

        # Create locks
        lock1 = manager.get_lock("key1")
        lock2 = manager.get_lock("key2")

        # Cleanup with only key1 active
        manager.cleanup({"key1"})

        # key2 lock should be removed
        lock3 = manager.get_lock("key2")
        assert lock3 is not lock2  # New lock created

    def test_concurrent_lock_creation(self):
        """Test that concurrent lock creation doesn't create duplicates."""
        manager = _LockManager()
        locks_created = []
        exceptions = []

        def create_lock():
            try:
                lock = manager.get_lock("concurrent_key")
                locks_created.append(lock)
            except Exception as e:
                exceptions.append(e)

        # Create multiple threads trying to get the same lock
        threads = [threading.Thread(target=create_lock) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(exceptions) == 0
        assert len(locks_created) == 10

        # All should be the same lock
        first_lock = locks_created[0]
        for lock in locks_created[1:]:
            assert lock is first_lock


class TestEngineManager:
    """Test the EngineManager class."""

    @pytest.fixture
    def engine_manager(self):
        """Create a mock EngineManager instance."""
        from contextlib import contextmanager

        @contextmanager
        def dummy_context_manager(
            database: MagicMock, catalog: str | None, schema: str | None
        ) -> Iterator[None]:
            yield

        return EngineManager(engine_context_manager=dummy_context_manager)

    @pytest.fixture
    def mock_database(self):
        """Create a mock database."""
        database = MagicMock()
        database.sqlalchemy_uri_decrypted = "postgresql://user:pass@localhost/test"
        database.get_extra.return_value = {"engine_params": {"poolclass": NullPool}}
        database.get_effective_user.return_value = "test_user"
        database.impersonate_user = False
        database.update_params_from_encrypted_extra = MagicMock()
        database.db_engine_spec = MagicMock()
        database.db_engine_spec.adjust_engine_params.return_value = (MagicMock(), {})
        database.db_engine_spec.impersonate_user = MagicMock(
            return_value=(MagicMock(), {})
        )
        database.db_engine_spec.validate_database_uri = MagicMock()
        database.ssh_tunnel = None
        return database

    @patch("superset.engines.manager.create_engine")
    @patch("superset.engines.manager.make_url_safe")
    def test_get_engine_new_mode(
        self, mock_make_url, mock_create_engine, engine_manager, mock_database
    ):
        """Test getting an engine in NEW mode (no caching)."""
        engine_manager.mode = EngineModes.NEW

        mock_make_url.return_value = MagicMock()
        mock_engine1 = MagicMock()
        mock_engine2 = MagicMock()
        mock_create_engine.side_effect = [mock_engine1, mock_engine2]

        result = engine_manager._get_engine(mock_database, "catalog1", "schema1", None)

        assert result is mock_engine1
        mock_create_engine.assert_called_once()

        # Calling again should create a new engine (no caching)
        mock_create_engine.reset_mock()
        result2 = engine_manager._get_engine(mock_database, "catalog2", "schema2", None)

        assert result2 is mock_engine2  # Different engine
        mock_create_engine.assert_called_once()

    @patch("superset.engines.manager.create_engine")
    @patch("superset.engines.manager.make_url_safe")
    def test_get_engine_singleton_mode_caching(
        self, mock_make_url, mock_create_engine, engine_manager, mock_database
    ):
        """Test that engines are cached in SINGLETON mode."""
        engine_manager.mode = EngineModes.SINGLETON

        # Use a real engine instead of MagicMock to avoid event listener issues
        from sqlalchemy import create_engine
        from sqlalchemy.pool import StaticPool

        real_engine = create_engine("sqlite:///:memory:", poolclass=StaticPool)
        mock_create_engine.return_value = real_engine
        mock_make_url.return_value = real_engine

        # Call twice with same params - should be cached
        result1 = engine_manager._get_engine(mock_database, "catalog1", "schema1", None)
        result2 = engine_manager._get_engine(mock_database, "catalog1", "schema1", None)

        assert result1 is result2  # Same engine returned (cached)
        mock_create_engine.assert_called_once()  # Only created once

        # Call with different params - should create new engine

    @patch("superset.engines.manager.create_engine")
    @patch("superset.engines.manager.make_url_safe")
    def test_concurrent_engine_creation(
        self, mock_make_url, mock_create_engine, engine_manager, mock_database
    ):
        """Test concurrent engine creation doesn't create duplicates."""
        engine_manager.mode = EngineModes.SINGLETON

        # Use a real engine to avoid event listener issues with MagicMock
        from sqlalchemy import create_engine
        from sqlalchemy.pool import StaticPool

        real_engine = create_engine("sqlite:///:memory:", poolclass=StaticPool)
        mock_make_url.return_value = real_engine

        create_count = [0]

        def counting_create_engine(*args, **kwargs):
            create_count[0] += 1
            return real_engine

        mock_create_engine.side_effect = counting_create_engine

        results = []
        exceptions = []

        def get_engine_thread():
            try:
                engine = engine_manager._get_engine(
                    mock_database, "catalog1", "schema1", None
                )
                results.append(engine)
            except Exception as e:
                exceptions.append(e)

        # Run multiple threads
        threads = [threading.Thread(target=get_engine_thread) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(exceptions) == 0
        assert len(results) == 10
        assert create_count[0] == 1  # Engine created only once

        # All results should be the same engine
        for engine in results:
            assert engine is real_engine

    @patch("superset.engines.manager.SSHTunnelForwarder")
    def test_ssh_tunnel_creation(self, mock_tunnel_class, engine_manager):
        """Test SSH tunnel creation and caching."""
        ssh_tunnel = MagicMock()
        ssh_tunnel.server_address = "ssh.example.com"
        ssh_tunnel.server_port = 22
        ssh_tunnel.username = "ssh_user"
        ssh_tunnel.password = "ssh_pass"
        ssh_tunnel.private_key = None
        ssh_tunnel.private_key_password = None

        tunnel_instance = MagicMock()
        tunnel_instance.is_active = True
        tunnel_instance.local_bind_address = ("127.0.0.1", 12345)
        mock_tunnel_class.return_value = tunnel_instance

        uri = MagicMock()
        uri.host = "db.example.com"
        uri.port = 5432
        uri.get_backend_name.return_value = "postgresql"

        result = engine_manager._get_tunnel(ssh_tunnel, uri)

        assert result is tunnel_instance
        mock_tunnel_class.assert_called_once()

        # Getting same tunnel again should return cached version
        mock_tunnel_class.reset_mock()
        result2 = engine_manager._get_tunnel(ssh_tunnel, uri)

        assert result2 is tunnel_instance
        mock_tunnel_class.assert_not_called()

    @patch("superset.engines.manager.SSHTunnelForwarder")
    def test_ssh_tunnel_recreation_when_inactive(
        self, mock_tunnel_class, engine_manager
    ):
        """Test that inactive tunnels are replaced."""
        ssh_tunnel = MagicMock()
        ssh_tunnel.server_address = "ssh.example.com"
        ssh_tunnel.server_port = 22
        ssh_tunnel.username = "ssh_user"
        ssh_tunnel.password = "ssh_pass"
        ssh_tunnel.private_key = None
        ssh_tunnel.private_key_password = None

        # First tunnel is inactive
        inactive_tunnel = MagicMock()
        inactive_tunnel.is_active = False
        inactive_tunnel.local_bind_address = ("127.0.0.1", 12345)

        # Second tunnel is active
        active_tunnel = MagicMock()
        active_tunnel.is_active = True
        active_tunnel.local_bind_address = ("127.0.0.1", 23456)

        mock_tunnel_class.side_effect = [inactive_tunnel, active_tunnel]

        uri = MagicMock()
        uri.host = "db.example.com"
        uri.port = 5432
        uri.get_backend_name.return_value = "postgresql"

        # First call creates inactive tunnel
        result1 = engine_manager._get_tunnel(ssh_tunnel, uri)
        assert result1 is inactive_tunnel

        # Second call should create new tunnel since first is inactive
        result2 = engine_manager._get_tunnel(ssh_tunnel, uri)
        assert result2 is active_tunnel
        assert mock_tunnel_class.call_count == 2

    @patch("superset.engines.manager.create_engine")
    @patch("superset.engines.manager.make_url_safe")
    def test_get_engine_args_basic(
        self, mock_make_url, mock_create_engine, engine_manager
    ):
        """Test _get_engine_args returns correct URI and kwargs."""
        from sqlalchemy.engine.url import make_url

        from superset.engines.manager import EngineModes

        engine_manager.mode = EngineModes.NEW

        mock_uri = make_url("trino://")
        mock_make_url.return_value = mock_uri

        database = MagicMock()
        database.id = 1
        database.sqlalchemy_uri_decrypted = "trino://"
        database.get_extra.return_value = {
            "engine_params": {},
            "connect_args": {"source": "Apache Superset"},
        }
        database.get_effective_user.return_value = "alice"
        database.impersonate_user = False
        database.update_params_from_encrypted_extra = MagicMock()
        database.db_engine_spec = MagicMock()
        database.db_engine_spec.adjust_engine_params.return_value = (
            mock_uri,
            {"source": "Apache Superset"},
        )
        database.db_engine_spec.validate_database_uri = MagicMock()

        uri, kwargs = engine_manager._get_engine_args(database, None, None, None, None)

        assert str(uri) == "trino://"
        assert "connect_args" in database.get_extra.return_value

    @patch("superset.engines.manager.create_engine")
    @patch("superset.engines.manager.make_url_safe")
    def test_get_engine_args_user_impersonation(
        self, mock_make_url, mock_create_engine, engine_manager
    ):
        """Test user impersonation in _get_engine_args."""
        from sqlalchemy.engine.url import make_url

        from superset.engines.manager import EngineModes

        engine_manager.mode = EngineModes.NEW

        mock_uri = make_url("trino://")
        mock_make_url.return_value = mock_uri

        database = MagicMock()
        database.id = 1
        database.sqlalchemy_uri_decrypted = "trino://"
        database.get_extra.return_value = {
            "engine_params": {},
            "connect_args": {"source": "Apache Superset"},
        }
        database.get_effective_user.return_value = "alice"
        database.impersonate_user = True
        database.get_oauth2_config.return_value = None
        database.update_params_from_encrypted_extra = MagicMock()
        database.db_engine_spec = MagicMock()
        database.db_engine_spec.adjust_engine_params.return_value = (
            mock_uri,
            {"source": "Apache Superset"},
        )
        database.db_engine_spec.impersonate_user.return_value = (
            mock_uri,
            {"connect_args": {"user": "alice", "source": "Apache Superset"}},
        )
        database.db_engine_spec.validate_database_uri = MagicMock()

        uri, kwargs = engine_manager._get_engine_args(database, None, None, None, None)

        # Verify impersonate_user was called
        database.db_engine_spec.impersonate_user.assert_called_once()
        call_args = database.db_engine_spec.impersonate_user.call_args
        assert call_args[0][0] is database  # database
        assert call_args[0][1] == "alice"  # username
        assert call_args[0][2] is None  # access_token (no OAuth2)

    @patch("superset.engines.manager.create_engine")
    @patch("superset.engines.manager.make_url_safe")
    def test_get_engine_args_user_impersonation_email_prefix(
        self,
        mock_make_url,
        mock_create_engine,
        engine_manager,
    ):
        """Test user impersonation with IMPERSONATE_WITH_EMAIL_PREFIX feature flag."""
        from sqlalchemy.engine.url import make_url

        from superset.engines.manager import EngineModes

        engine_manager.mode = EngineModes.NEW

        mock_uri = make_url("trino://")
        mock_make_url.return_value = mock_uri

        # Mock user with email
        mock_user = MagicMock()
        mock_user.email = "alice.doe@example.org"

        database = MagicMock()
        database.id = 1
        database.sqlalchemy_uri_decrypted = "trino://"
        database.get_extra.return_value = {
            "engine_params": {},
            "connect_args": {"source": "Apache Superset"},
        }
        database.get_effective_user.return_value = "alice"
        database.impersonate_user = True
        database.get_oauth2_config.return_value = None
        database.update_params_from_encrypted_extra = MagicMock()
        database.db_engine_spec = MagicMock()
        database.db_engine_spec.adjust_engine_params.return_value = (
            mock_uri,
            {"source": "Apache Superset"},
        )
        database.db_engine_spec.impersonate_user.return_value = (
            mock_uri,
            {"connect_args": {"user": "alice.doe", "source": "Apache Superset"}},
        )
        database.db_engine_spec.validate_database_uri = MagicMock()

        with (
            patch(
                "superset.utils.feature_flag_manager.FeatureFlagManager.is_feature_enabled",
                return_value=True,
            ),
            patch(
                "superset.extensions.security_manager.find_user",
                return_value=mock_user,
            ),
        ):
            uri, kwargs = engine_manager._get_engine_args(
                database, None, None, None, None
            )

        # Verify impersonate_user was called with the email prefix
        database.db_engine_spec.impersonate_user.assert_called_once()
        call_args = database.db_engine_spec.impersonate_user.call_args
        assert call_args[0][1] == "alice.doe"  # username from email prefix

    @patch("superset.engines.manager.create_engine")
    @patch("superset.engines.manager.make_url_safe")
    def test_engine_context_manager_called(
        self, mock_make_url, mock_create_engine, engine_manager, mock_database
    ):
        """Test that the engine context manager is properly called."""
        from sqlalchemy.engine.url import make_url

        mock_uri = make_url("trino://")
        mock_make_url.return_value = mock_uri
        mock_engine = MagicMock()
        mock_create_engine.return_value = mock_engine

        # Track context manager calls
        context_manager_calls = []

        def tracking_context_manager(database, catalog, schema):
            from contextlib import contextmanager

            @contextmanager
            def inner():
                context_manager_calls.append(("enter", database, catalog, schema))
                yield
                context_manager_calls.append(("exit", database, catalog, schema))

            return inner()

        engine_manager.engine_context_manager = tracking_context_manager

        with engine_manager.get_engine(mock_database, "catalog1", "schema1", None):
            pass

        assert len(context_manager_calls) == 2
        assert context_manager_calls[0][0] == "enter"
        assert context_manager_calls[0][1] is mock_database
        assert context_manager_calls[0][2] == "catalog1"
        assert context_manager_calls[0][3] == "schema1"
        assert context_manager_calls[1][0] == "exit"

    @patch("superset.utils.oauth2.check_for_oauth2")
    @patch("superset.engines.manager.create_engine")
    @patch("superset.engines.manager.make_url_safe")
    def test_engine_oauth2_error_handling(
        self,
        mock_make_url,
        mock_create_engine,
        mock_check_for_oauth2,
        engine_manager,
        mock_database,
    ):
        """Test that OAuth2 errors are properly propagated from get_engine."""
        from contextlib import contextmanager

        from sqlalchemy.engine.url import make_url

        mock_uri = make_url("trino://")
        mock_make_url.return_value = mock_uri

        # Simulate OAuth2 error during engine creation
        class OAuth2TestError(Exception):
            pass

        oauth_error = OAuth2TestError("OAuth2 required")
        mock_create_engine.side_effect = oauth_error

        # Make get_dbapi_mapped_exception return the original exception
        mock_database.db_engine_spec.get_dbapi_mapped_exception.return_value = (
            oauth_error
        )

        # Mock check_for_oauth2 to re-raise the exception
        @contextmanager
        def mock_oauth2_context(database):
            try:
                yield
            except OAuth2TestError:
                raise

        mock_check_for_oauth2.return_value = mock_oauth2_context(mock_database)

        with pytest.raises(OAuth2TestError, match="OAuth2 required"):
            with engine_manager.get_engine(mock_database, "catalog1", "schema1", None):
                pass

    @patch("superset.engines.manager.create_engine")
    @patch("superset.engines.manager.make_url_safe")
    def test_connect_args_from_engine_params_preserved(
        self, mock_make_url, mock_create_engine, engine_manager
    ):
        """Test that connect_args nested in engine_params are properly passed through."""
        from sqlalchemy.engine.url import make_url

        engine_manager.mode = EngineModes.NEW

        mock_uri = make_url("databricks://token:secret@host/db")
        mock_make_url.return_value = mock_uri
        mock_create_engine.return_value = MagicMock()

        # Setup database with connect_args inside engine_params (the correct pattern)
        database = MagicMock()
        database.id = 1
        database.sqlalchemy_uri_decrypted = "databricks://token:secret@host/db"
        database.get_extra.return_value = {
            "engine_params": {
                "connect_args": {
                    "http_path": "/sql/1.0/warehouses/abc123",
                    "ssl": {"ca": "/path/to/ca.pem"},
                }
            }
        }
        database.get_effective_user.return_value = "alice"
        database.impersonate_user = False
        database.update_params_from_encrypted_extra = MagicMock()
        database.db_engine_spec = MagicMock()
        # adjust_engine_params should receive the connect_args and can modify them
        database.db_engine_spec.adjust_engine_params.side_effect = (
            lambda uri, connect_args, catalog, schema: (
                uri,
                {**connect_args, "adjusted": True},
            )
        )
        database.db_engine_spec.validate_database_uri = MagicMock()
        database.ssh_tunnel = None

        uri, kwargs = engine_manager._get_engine_args(database, None, None, None, None)

        # Verify adjust_engine_params received the connect_args from engine_params
        call_args = database.db_engine_spec.adjust_engine_params.call_args
        connect_args_passed = call_args[0][1]
        assert connect_args_passed["http_path"] == "/sql/1.0/warehouses/abc123"
        assert connect_args_passed["ssl"] == {"ca": "/path/to/ca.pem"}

        # Verify the returned kwargs has the updated connect_args
        assert "connect_args" in kwargs
        assert kwargs["connect_args"]["adjusted"] is True

    @patch("superset.engines.manager.create_engine")
    @patch("superset.engines.manager.make_url_safe")
    def test_poolclass_from_engine_params(
        self, mock_make_url, mock_create_engine, engine_manager
    ):
        """Test that poolclass string in engine_params is resolved to actual pool class."""
        from sqlalchemy.engine.url import make_url
        from sqlalchemy.pool import QueuePool

        engine_manager.mode = EngineModes.SINGLETON

        mock_uri = make_url("postgresql://user:pass@localhost/db")
        mock_make_url.return_value = mock_uri
        mock_create_engine.return_value = MagicMock()

        database = MagicMock()
        database.id = 1
        database.sqlalchemy_uri_decrypted = "postgresql://user:pass@localhost/db"
        database.get_extra.return_value = {
            "engine_params": {
                "poolclass": "queue",  # String name, should be resolved to QueuePool
                "pool_size": 10,
            }
        }
        database.get_effective_user.return_value = "alice"
        database.impersonate_user = False
        database.update_params_from_encrypted_extra = MagicMock()
        database.db_engine_spec = MagicMock()
        database.db_engine_spec.adjust_engine_params.return_value = (mock_uri, {})
        database.db_engine_spec.validate_database_uri = MagicMock()
        database.ssh_tunnel = None

        uri, kwargs = engine_manager._get_engine_args(database, None, None, None, None)

        # poolclass should be resolved from string "queue" to QueuePool class
        assert kwargs["poolclass"] is QueuePool
        # pool_size should be preserved
        assert kwargs["pool_size"] == 10

    @patch("superset.engines.manager.create_engine")
    @patch("superset.engines.manager.make_url_safe")
    def test_poolclass_unknown_defaults_to_queue(
        self, mock_make_url, mock_create_engine, engine_manager
    ):
        """Test that unknown poolclass string defaults to QueuePool."""
        from sqlalchemy.engine.url import make_url
        from sqlalchemy.pool import QueuePool

        engine_manager.mode = EngineModes.SINGLETON

        mock_uri = make_url("postgresql://user:pass@localhost/db")
        mock_make_url.return_value = mock_uri

        database = MagicMock()
        database.id = 1
        database.sqlalchemy_uri_decrypted = "postgresql://user:pass@localhost/db"
        database.get_extra.return_value = {
            "engine_params": {
                "poolclass": "unknown_pool_type",  # Invalid, should default to QueuePool
            }
        }
        database.get_effective_user.return_value = "alice"
        database.impersonate_user = False
        database.update_params_from_encrypted_extra = MagicMock()
        database.db_engine_spec = MagicMock()
        database.db_engine_spec.adjust_engine_params.return_value = (mock_uri, {})
        database.db_engine_spec.validate_database_uri = MagicMock()
        database.ssh_tunnel = None

        uri, kwargs = engine_manager._get_engine_args(database, None, None, None, None)

        assert kwargs["poolclass"] is QueuePool

    @patch("superset.engines.manager.create_engine")
    @patch("superset.engines.manager.make_url_safe")
    def test_new_mode_always_uses_nullpool(
        self, mock_make_url, mock_create_engine, engine_manager
    ):
        """Test that NEW mode ignores poolclass config and uses NullPool."""
        from sqlalchemy.engine.url import make_url

        engine_manager.mode = EngineModes.NEW

        mock_uri = make_url("postgresql://user:pass@localhost/db")
        mock_make_url.return_value = mock_uri

        database = MagicMock()
        database.id = 1
        database.sqlalchemy_uri_decrypted = "postgresql://user:pass@localhost/db"
        database.get_extra.return_value = {
            "engine_params": {
                "poolclass": "queue",  # Should be ignored in NEW mode
            }
        }
        database.get_effective_user.return_value = "alice"
        database.impersonate_user = False
        database.update_params_from_encrypted_extra = MagicMock()
        database.db_engine_spec = MagicMock()
        database.db_engine_spec.adjust_engine_params.return_value = (mock_uri, {})
        database.db_engine_spec.validate_database_uri = MagicMock()
        database.ssh_tunnel = None

        uri, kwargs = engine_manager._get_engine_args(database, None, None, None, None)

        # NEW mode always uses NullPool regardless of config
        assert kwargs["poolclass"] is NullPool
