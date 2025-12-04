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

import enum
import hashlib
import logging
import threading
from contextlib import contextmanager
from datetime import timedelta
from io import StringIO
from typing import Any, Iterator, TYPE_CHECKING

import sshtunnel
from paramiko import RSAKey
from sqlalchemy import create_engine, event, pool
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import URL
from sshtunnel import SSHTunnelForwarder

from superset.databases.utils import make_url_safe
from superset.superset_typing import DBConnectionMutator, EngineContextManager
from superset.utils.core import get_query_source_from_request, get_user_id, QuerySource

if TYPE_CHECKING:
    from superset.databases.ssh_tunnel.models import SSHTunnel
    from superset.models.core import Database


logger = logging.getLogger(__name__)


class _LockManager:
    """
    Manages per-key locks safely without defaultdict race conditions.

    This class provides a thread-safe way to create and manage locks for specific keys,
    avoiding the race conditions that occur when using defaultdict with threading.Lock.

    The implementation uses a two-level locking strategy:
    1. A meta-lock to protect the lock dictionary itself
    2. Per-key locks to protect specific resources

    This ensures that:
    - Different keys can be locked concurrently (scalability)
    - Lock creation is thread-safe (no race conditions)
    - The same key always gets the same lock instance
    """

    def __init__(self) -> None:
        self._locks: dict[str, threading.RLock] = {}
        self._meta_lock = threading.Lock()

    def get_lock(self, key: str) -> threading.RLock:
        """
        Get or create a lock for the given key.

        This method uses double-checked locking to ensure thread safety:
        1. First check without lock (fast path)
        2. Acquire meta-lock if needed
        3. Double-check inside the lock to prevent race conditions

        This approach minimizes lock contention while ensuring correctness.

        :param key: The key to get a lock for
        :returns: An RLock instance for the given key
        """
        if lock := self._locks.get(key):
            return lock

        with self._meta_lock:
            # Double-check inside the lock
            lock = self._locks.get(key)
            if lock is None:
                lock = threading.RLock()
                self._locks[key] = lock
            return lock

    def cleanup(self, active_keys: set[str]) -> None:
        """
        Remove locks for keys that are no longer in use.

        This prevents memory leaks from accumulating locks for resources
        that have been disposed.

        :param active_keys: Set of keys that are still active
        """
        with self._meta_lock:
            # Find locks to remove
            locks_to_remove = self._locks.keys() - active_keys
            for key in locks_to_remove:
                self._locks.pop(key, None)


EngineKey = str
TunnelKey = str


def _generate_cache_key(*args: Any) -> str:
    """
    Generate a deterministic cache key from arbitrary arguments.

    Uses repr() for serialization and SHA-256 for hashing. The resulting key
    is a 32-character hex string that:
    1. Is deterministic for the same inputs
    2. Does not expose sensitive data (everything is hashed)
    3. Has sufficient entropy to avoid collisions

    :param args: Arguments to include in the cache key
    :returns: 32-character hex string
    """
    # Use repr() which works with most Python objects and is deterministic
    serialized = repr(args).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()[:32]


class EngineModes(enum.Enum):
    # reuse existing engine if available, otherwise create a new one; this mode should
    # have a connection pool configured in the database
    SINGLETON = enum.auto()

    # always create a new engine for every connection; this mode will use a NullPool
    # and is the default behavior for Superset
    NEW = enum.auto()


class EngineManager:
    """
    A manager for SQLAlchemy engines.

    This class handles the creation and management of SQLAlchemy engines, allowing them
    to be configured with connection pools and reused across requests. The default mode
    is the original behavior for Superset, where we create a new engine for every
    connection, using a NullPool. The `SINGLETON` mode, on the other hand, allows for
    reusing of the engines, as well as configuring the pool through the database
    settings.
    """

    def __init__(
        self,
        engine_context_manager: EngineContextManager,
        db_connection_mutator: DBConnectionMutator | None = None,
        mode: EngineModes = EngineModes.NEW,
        cleanup_interval: timedelta = timedelta(minutes=5),
        local_bind_address: str = "127.0.0.1",
        tunnel_timeout: timedelta = timedelta(seconds=30),
        ssh_timeout: timedelta = timedelta(seconds=1),
    ) -> None:
        self.engine_context_manager = engine_context_manager
        self.db_connection_mutator = db_connection_mutator
        self.mode = mode
        self.cleanup_interval = cleanup_interval
        self.local_bind_address = local_bind_address

        sshtunnel.TUNNEL_TIMEOUT = tunnel_timeout.total_seconds()
        sshtunnel.SSH_TIMEOUT = ssh_timeout.total_seconds()

        self._engines: dict[EngineKey, Engine] = {}
        self._engine_locks = _LockManager()
        self._tunnels: dict[TunnelKey, SSHTunnelForwarder] = {}
        self._tunnel_locks = _LockManager()

        # Background cleanup thread management
        self._cleanup_thread: threading.Thread | None = None
        self._cleanup_stop_event = threading.Event()
        self._cleanup_thread_lock = threading.Lock()

    def __del__(self) -> None:
        """
        Ensure cleanup thread is stopped when the manager is destroyed.
        """
        try:
            self.stop_cleanup_thread()
        except Exception as ex:
            # Avoid exceptions during garbage collection, but log if possible
            try:
                logger.warning("Error stopping cleanup thread: %s", ex)
            except Exception:  # noqa: S110
                # If logging fails during destruction, we can't do anything
                pass

    @contextmanager
    def get_engine(
        self,
        database: "Database",
        catalog: str | None,
        schema: str | None,
        source: QuerySource | None,
    ) -> Iterator[Engine]:
        """
        Context manager to get a SQLAlchemy engine.
        """
        # users can wrap the engine in their own context manager for different
        # reasons
        with self.engine_context_manager(database, catalog, schema):
            # we need to check for errors indicating that OAuth2 is needed, and
            # return the proper exception so it starts the authentication flow
            from superset.utils.oauth2 import check_for_oauth2

            with check_for_oauth2(database):
                yield self._get_engine(database, catalog, schema, source)

    def _get_engine(
        self,
        database: "Database",
        catalog: str | None,
        schema: str | None,
        source: QuerySource | None,
    ) -> Engine:
        """
        Get a specific engine, or create it if none exists.
        """
        source = source or get_query_source_from_request()
        user_id = get_user_id()

        if self.mode == EngineModes.NEW:
            return self._create_engine(
                database,
                catalog,
                schema,
                source,
                user_id,
            )

        engine_key = self._get_engine_key(
            database,
            catalog,
            schema,
            source,
            user_id,
        )

        if engine := self._engines.get(engine_key):
            return engine

        lock = self._engine_locks.get_lock(engine_key)
        with lock:
            # Double-check inside the lock
            if engine := self._engines.get(engine_key):
                return engine

            # Create and cache the engine
            engine = self._create_engine(
                database,
                catalog,
                schema,
                source,
                user_id,
            )
            self._engines[engine_key] = engine
            self._add_disposal_listener(engine, engine_key)
            return engine

    def _get_engine_key(
        self,
        database: "Database",
        catalog: str | None,
        schema: str | None,
        source: QuerySource | None,
        user_id: int | None,
    ) -> EngineKey:
        """
        Generate a cache key for the engine.

        The key is a hash of all parameters that affect the engine, ensuring
        proper cache isolation without exposing sensitive data.

        :returns: 32-character hex string
        """
        uri, kwargs = self._get_engine_args(
            database,
            catalog,
            schema,
            source,
            user_id,
        )

        return _generate_cache_key(
            database.id,
            catalog,
            schema,
            str(uri),
            source,
            user_id,
            kwargs,
        )

    def _get_engine_args(
        self,
        database: "Database",
        catalog: str | None,
        schema: str | None,
        source: QuerySource | None,
        user_id: int | None,
    ) -> tuple[URL, dict[str, Any]]:
        """
        Build the almost final SQLAlchemy URI and engine kwargs.

        "Almost" final because we may still need to mutate the URI if an SSH tunnel is
        needed, since it needs to connect to the tunnel instead of the original DB. But
        that information is only available after the tunnel is created.
        """
        # Import here to avoid circular imports
        from superset.extensions import security_manager
        from superset.utils.feature_flag_manager import FeatureFlagManager

        uri = make_url_safe(database.sqlalchemy_uri_decrypted)

        extra = database.get_extra(source)
        kwargs = extra.get("engine_params", {})

        # get pool class
        if self.mode == EngineModes.NEW or "poolclass" not in extra:
            kwargs["poolclass"] = pool.NullPool
        else:
            pools = {
                "queue": pool.QueuePool,
                "singleton": pool.SingletonThreadPool,
                "assertion": pool.AssertionPool,
                "null": pool.NullPool,
                "static": pool.StaticPool,
            }
            kwargs["poolclass"] = pools.get(extra["poolclass"], pool.QueuePool)

        # update URI for specific catalog/schema
        connect_args = extra.setdefault("connect_args", {})
        uri, connect_args = database.db_engine_spec.adjust_engine_params(
            uri,
            connect_args,
            catalog,
            schema,
        )

        # get effective username
        username = database.get_effective_user(uri)

        feature_flag_manager = FeatureFlagManager()
        if username and feature_flag_manager.is_feature_enabled(
            "IMPERSONATE_WITH_EMAIL_PREFIX"
        ):
            user = security_manager.find_user(username=username)
            if user and user.email and "@" in user.email:
                username = user.email.split("@")[0]

        # update URI/kwargs for user impersonation
        if database.impersonate_user:
            oauth2_config = database.get_oauth2_config()
            # Import here to avoid circular imports
            from superset.utils.oauth2 import get_oauth2_access_token

            access_token = (
                get_oauth2_access_token(
                    oauth2_config,
                    database.id,
                    user_id,
                    database.db_engine_spec,
                )
                if oauth2_config and user_id
                else None
            )

            uri, kwargs = database.db_engine_spec.impersonate_user(
                database,
                username,
                access_token,
                uri,
                kwargs,
            )

        # update kwargs from params stored encrupted at rest
        database.update_params_from_encrypted_extra(kwargs)

        # mutate URI
        if self.db_connection_mutator:
            source = source or get_query_source_from_request()
            # Import here to avoid circular imports
            from superset.extensions import security_manager

            uri, kwargs = self.db_connection_mutator(
                uri,
                kwargs,
                username,
                security_manager,
                source,
            )

        # validate final URI
        database.db_engine_spec.validate_database_uri(uri)

        return uri, kwargs

    def _create_engine(
        self,
        database: "Database",
        catalog: str | None,
        schema: str | None,
        source: QuerySource | None,
        user_id: int | None,
    ) -> Engine:
        """
        Create the actual engine.

        This should be the only place in Superset where a SQLAlchemy engine is created,
        """
        uri, kwargs = self._get_engine_args(
            database,
            catalog,
            schema,
            source,
            user_id,
        )

        if database.ssh_tunnel:
            tunnel = self._get_tunnel(database.ssh_tunnel, uri)
            uri = uri.set(
                host=tunnel.local_bind_address[0],
                port=tunnel.local_bind_port,
            )

        try:
            engine = create_engine(uri, **kwargs)
        except Exception as ex:
            raise database.db_engine_spec.get_dbapi_mapped_exception(ex) from ex

        return engine

    def _get_tunnel(self, ssh_tunnel: "SSHTunnel", uri: URL) -> SSHTunnelForwarder:
        tunnel_key = self._get_tunnel_key(ssh_tunnel, uri)

        tunnel = self._tunnels.get(tunnel_key)
        if tunnel is not None and tunnel.is_active:
            return tunnel

        lock = self._tunnel_locks.get_lock(tunnel_key)
        with lock:
            # Double-check inside the lock
            tunnel = self._tunnels.get(tunnel_key)
            if tunnel is not None and tunnel.is_active:
                return tunnel

            # Create or replace tunnel
            return self._replace_tunnel(tunnel_key, ssh_tunnel, uri, tunnel)

    def _replace_tunnel(
        self,
        tunnel_key: str,
        ssh_tunnel: "SSHTunnel",
        uri: URL,
        old_tunnel: SSHTunnelForwarder | None,
    ) -> SSHTunnelForwarder:
        """
        Replace tunnel with proper cleanup.

        This function assumes caller holds lock.
        """
        if old_tunnel:
            try:
                old_tunnel.stop()
            except Exception:
                logger.exception("Error stopping old tunnel")

        try:
            new_tunnel = self._create_tunnel(ssh_tunnel, uri)
            self._tunnels[tunnel_key] = new_tunnel
        except Exception:
            # Remove failed tunnel from cache
            self._tunnels.pop(tunnel_key, None)
            logger.exception("Failed to create tunnel")
            raise

        return new_tunnel

    def _get_tunnel_key(self, ssh_tunnel: "SSHTunnel", uri: URL) -> TunnelKey:
        """
        Generate a cache key for the SSH tunnel.

        :returns: 32-character hex string
        """
        tunnel_kwargs = self._get_tunnel_kwargs(ssh_tunnel, uri)
        return _generate_cache_key(tunnel_kwargs)

    def _create_tunnel(self, ssh_tunnel: "SSHTunnel", uri: URL) -> SSHTunnelForwarder:
        kwargs = self._get_tunnel_kwargs(ssh_tunnel, uri)
        tunnel = SSHTunnelForwarder(**kwargs)
        tunnel.start()

        return tunnel

    def _get_tunnel_kwargs(self, ssh_tunnel: "SSHTunnel", uri: URL) -> dict[str, Any]:
        # Import here to avoid circular imports
        from superset.utils.ssh_tunnel import get_default_port

        backend = uri.get_backend_name()
        kwargs = {
            "ssh_address_or_host": (ssh_tunnel.server_address, ssh_tunnel.server_port),
            "ssh_username": ssh_tunnel.username,
            "remote_bind_address": (uri.host, uri.port or get_default_port(backend)),
            "local_bind_address": (self.local_bind_address,),
            "debug_level": logging.getLogger("flask_appbuilder").level,
        }

        if ssh_tunnel.password:
            kwargs["ssh_password"] = ssh_tunnel.password
        elif ssh_tunnel.private_key:
            private_key_file = StringIO(ssh_tunnel.private_key)
            private_key = RSAKey.from_private_key(
                private_key_file,
                ssh_tunnel.private_key_password,
            )
            kwargs["ssh_pkey"] = private_key

        if self.mode == EngineModes.NEW:
            kwargs["keepalive"] = 0  # disable

        return kwargs

    def start_cleanup_thread(self) -> None:
        """
        Start the background cleanup thread.

        The thread will periodically clean up abandoned locks at the configured
        interval. This is safe to call multiple times - subsequent calls are no-ops.
        """
        with self._cleanup_thread_lock:
            if self._cleanup_thread is None or not self._cleanup_thread.is_alive():
                self._cleanup_stop_event.clear()
                self._cleanup_thread = threading.Thread(
                    target=self._cleanup_worker,
                    name=f"EngineManager-cleanup-{id(self)}",
                    daemon=True,
                )
                self._cleanup_thread.start()
                logger.info(
                    "Started cleanup thread with %ds interval",
                    self.cleanup_interval.total_seconds(),
                )

    def stop_cleanup_thread(self) -> None:
        """
        Stop the background cleanup thread gracefully.

        This will signal the thread to stop and wait for it to finish.
        Safe to call even if no thread is running.
        """
        with self._cleanup_thread_lock:
            if self._cleanup_thread is not None and self._cleanup_thread.is_alive():
                self._cleanup_stop_event.set()
                self._cleanup_thread.join(timeout=5.0)  # 5 second timeout
                if self._cleanup_thread.is_alive():
                    logger.warning("Cleanup thread did not stop within timeout")
                else:
                    logger.info("Cleanup thread stopped")
                self._cleanup_thread = None

    def _cleanup_worker(self) -> None:
        """
        Background thread worker that periodically cleans up abandoned locks.
        """
        while not self._cleanup_stop_event.is_set():
            try:
                self._cleanup_abandoned_locks()
            except Exception:
                logger.exception("Error during background cleanup")

            # Use wait() instead of sleep() to allow for immediate shutdown
            if self._cleanup_stop_event.wait(
                timeout=self.cleanup_interval.total_seconds()
            ):
                break  # Stop event was set

    def cleanup(self) -> None:
        """
        Public method to manually trigger cleanup of abandoned locks.

        This can be called periodically by external systems to prevent
        memory leaks from accumulating locks.
        """
        self._cleanup_abandoned_locks()

    def _cleanup_abandoned_locks(self) -> None:
        """
        Clean up locks for engines and tunnels that no longer exist.

        This prevents memory leaks from accumulating locks when engines/tunnels
        are disposed outside of normal cleanup paths.
        """
        # Clean up engine locks for inactive engines
        active_engine_keys = set(self._engines.keys())
        self._engine_locks.cleanup(active_engine_keys)

        # Clean up tunnel locks for inactive tunnels
        active_tunnel_keys = set(self._tunnels.keys())
        self._tunnel_locks.cleanup(active_tunnel_keys)

        # Log for debugging
        if active_engine_keys or active_tunnel_keys:
            logger.debug(
                "EngineManager resources - Engines: %d, Tunnels: %d",
                len(active_engine_keys),
                len(active_tunnel_keys),
            )

    def _add_disposal_listener(self, engine: Engine, engine_key: EngineKey) -> None:
        @event.listens_for(engine, "engine_disposed")
        def on_engine_disposed(engine_instance: Engine) -> None:
            try:
                # Remove engine from cache - no per-key locks to clean up anymore
                if self._engines.pop(engine_key, None):
                    # Log only first 8 chars of hash for safety
                    # (still enough for debugging, but doesn't expose full key)
                    log_key = engine_key[:8] + "..."
                    logger.info("Engine disposed and removed from cache: %s", log_key)
            except Exception as ex:
                logger.error("Error during engine disposal cleanup: %s", str(ex))
                # Don't log engine_key to avoid exposing credential hash
