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
import logging
import threading
from collections import defaultdict
from contextlib import contextmanager
from io import StringIO
from typing import Any, TYPE_CHECKING

from flask import current_app
from paramiko import RSAKey
from sqlalchemy import create_engine, event, pool
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import URL
from sshtunnel import SSHTunnelForwarder

from superset import is_feature_enabled
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.databases.utils import make_url_safe
from superset.extensions import security_manager
from superset.utils.core import get_query_source_from_request, get_user_id, QuerySource
from superset.utils.json import dumps
from superset.utils.oauth2 import check_for_oauth2, get_oauth2_access_token
from superset.utils.ssh_tunnel import get_default_port

if TYPE_CHECKING:
    from superset.models.core import Database


logger = logging.getLogger(__name__)


EngineKey = str
TunnelKey = str


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
    is the default behavior for Superset, where we create a new engine for every
    connection, using a NullPool. The `SINGLETON` mode allows for reusing of the
    engines, as well as configuring the pool through the database settings.
    """

    def __init__(self, mode: EngineModes = EngineModes.NEW) -> None:
        self.mode = mode

        self._engines: dict[EngineKey, Engine] = {}
        self._engine_locks: dict[EngineKey, threading.Lock] = defaultdict(
            threading.Lock
        )

        self._tunnels: dict[TunnelKey, SSHTunnelForwarder] = {}
        self._tunnel_locks: dict[TunnelKey, threading.Lock] = defaultdict(
            threading.Lock
        )

    @contextmanager
    def get_engine(
        self,
        database: Database,
        catalog: str | None,
        schema: str | None,
        source: QuerySource | None,
    ) -> Engine:
        """
        Context manager to get a SQLAlchemy engine.
        """
        # users can wrap the engine in their own context manager for different
        # reasons
        customization = current_app.config["ENGINE_CONTEXT_MANAGER"]
        with customization(database, catalog, schema):
            # we need to check for errors indicating that OAuth2 is needed, and
            # return the proper exception so it starts the authentication flow
            with check_for_oauth2(database):
                yield self._get_engine(database, catalog, schema, source)

    def _get_engine(
        self,
        database: Database,
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

        if engine_key not in self._engines:
            with self._engine_locks[engine_key]:
                # double-checked locking to ensure thread safety and prevent unnecessary
                # engine creation
                if engine_key not in self._engines:
                    engine = self._create_engine(
                        database,
                        catalog,
                        schema,
                        source,
                        user_id,
                    )
                    self._engines[engine_key] = engine
                    self._add_disposal_listener(engine, engine_key)

        return self._engines[engine_key]

    def _get_engine_key(
        self,
        database: Database,
        catalog: str | None,
        schema: str | None,
        source: QuerySource | None,
        user_id: int | None,
    ) -> EngineKey:
        """
        Generate a unique key for the engine based on the database and context.
        """
        uri, keys = self._get_engine_args(
            database,
            catalog,
            schema,
            source,
            user_id,
        )
        keys["uri"] = uri
        keys["source"] = source

        return dumps(keys, sort_keys=True)

    def _get_engine_args(
        self,
        database: Database,
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
        if username and is_feature_enabled("IMPERSONATE_WITH_EMAIL_PREFIX"):
            user = security_manager.find_user(username=username)
            if user and user.email and "@" in user.email:
                username = user.email.split("@")[0]

        # update URI/kwargs for user impersonation
        if database.impersonate_user:
            oauth2_config = database.get_oauth2_config()
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
        if mutator := current_app.config["DB_CONNECTION_MUTATOR"]:
            source = source or get_query_source_from_request()
            uri, kwargs = mutator(
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
        database: Database,
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

        tunnel = None
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

    def _get_tunnel(self, ssh_tunnel: SSHTunnel, uri: URL) -> SSHTunnelForwarder:
        tunnel_key = self._get_tunnel_key(ssh_tunnel, uri)

        #  tunnel exists and is healthy
        if tunnel_key in self._tunnels:
            tunnel = self._tunnels[tunnel_key]
            if tunnel.is_active:
                return tunnel

        # create or recreate tunnel
        with self._tunnel_locks[tunnel_key]:
            existing_tunnel = self._tunnels.get(tunnel_key)
            if existing_tunnel and existing_tunnel.is_active:
                return existing_tunnel

            # replace inactive or missing tunnel
            return self._replace_tunnel(tunnel_key, ssh_tunnel, uri, existing_tunnel)

    def _replace_tunnel(
        self,
        tunnel_key: str,
        ssh_tunnel: SSHTunnel,
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

    def _get_tunnel_key(self, ssh_tunnel: SSHTunnel, uri: URL) -> TunnelKey:
        """
        Build a unique key for the SSH tunnel.
        """
        keys = self._get_tunnel_kwargs(ssh_tunnel, uri)

        return dumps(keys, sort_keys=True)

    def _create_tunnel(self, ssh_tunnel: SSHTunnel, uri: URL) -> SSHTunnelForwarder:
        kwargs = self._get_tunnel_kwargs(ssh_tunnel, uri)
        tunnel = SSHTunnelForwarder(**kwargs)
        tunnel.start()

        return tunnel

    def _get_tunnel_kwargs(self, ssh_tunnel: SSHTunnel, uri: URL) -> dict[str, Any]:
        backend = uri.get_backend_name()
        kwargs = {
            "ssh_address_or_host": (ssh_tunnel.server_address, ssh_tunnel.server_port),
            "ssh_username": ssh_tunnel.username,
            "remote_bind_address": (uri.host, uri.port or get_default_port(backend)),
            "local_bind_address": (ssh_tunnel.local_bind_address,),
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

    def _add_disposal_listener(self, engine: Engine, engine_key: EngineKey) -> None:
        @event.listens_for(engine, "engine_disposed")
        def on_engine_disposed(engine_instance: Engine) -> None:
            try:
                # `pop` is atomic -- no lock needed
                if self._engines.pop(engine_key, None):
                    logger.info(f"Engine disposed and removed from cache: {engine_key}")
                    self._engine_locks.pop(engine_key, None)
            except Exception as ex:
                logger.error(
                    "Error during engine disposal cleanup for %s: %s",
                    engine_key,
                    str(ex),
                )
