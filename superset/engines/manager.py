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

from contextlib import contextmanager
from datetime import timedelta
from io import StringIO
from typing import Any, Iterator, TYPE_CHECKING

import sshtunnel
from paramiko import RSAKey
from sqlalchemy import create_engine, pool
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import URL
from sshtunnel import SSHTunnelForwarder

from superset.commands.database.ssh_tunnel.exceptions import SSHTunnelDatabasePortError
from superset.databases.utils import make_url_safe
from superset.superset_typing import DBConnectionMutator, EngineContextManager
from superset.utils.core import get_query_source_from_request, get_user_id, QuerySource

if TYPE_CHECKING:
    from superset.databases.ssh_tunnel.models import SSHTunnel
    from superset.models.core import Database


class EngineManager:
    """Centralized SQLAlchemy engine creation for Superset."""

    def __init__(
        self,
        engine_context_manager: EngineContextManager,
        db_connection_mutator: DBConnectionMutator | None = None,
        local_bind_address: str = "127.0.0.1",
        tunnel_timeout: timedelta = timedelta(seconds=30),
        ssh_timeout: timedelta = timedelta(seconds=1),
    ) -> None:
        self.engine_context_manager = engine_context_manager
        self.db_connection_mutator = db_connection_mutator
        self.local_bind_address = local_bind_address

        sshtunnel.TUNNEL_TIMEOUT = tunnel_timeout.total_seconds()
        sshtunnel.SSH_TIMEOUT = ssh_timeout.total_seconds()

    @contextmanager
    def get_engine(
        self,
        database: "Database",
        catalog: str | None,
        schema: str | None,
        source: QuerySource | None,
    ) -> Iterator[Engine]:
        """Context manager to get a SQLAlchemy engine."""
        from superset.utils.oauth2 import check_for_oauth2

        with self.engine_context_manager(database, catalog, schema):
            with check_for_oauth2(database):
                uri, kwargs = self._get_engine_args(
                    database,
                    catalog,
                    schema,
                    source,
                    get_user_id(),
                )

                if database.ssh_tunnel:
                    tunnel = self._create_tunnel(database.ssh_tunnel, uri)
                    try:
                        uri = uri.set(
                            host=tunnel.local_bind_address[0],
                            port=tunnel.local_bind_port,
                        )
                        yield self._create_engine(database, uri, kwargs)
                    finally:
                        tunnel.stop()
                else:
                    yield self._create_engine(database, uri, kwargs)

    def _get_engine_args(
        self,
        database: "Database",
        catalog: str | None,
        schema: str | None,
        source: QuerySource | None,
        user_id: int | None,
    ) -> tuple[URL, dict[str, Any]]:
        """Build SQLAlchemy URI and kwargs before engine creation."""
        from superset import is_feature_enabled
        from superset.extensions import security_manager

        uri = make_url_safe(database.sqlalchemy_uri_decrypted)
        extra = database.get_extra(source)
        kwargs = dict(extra.get("engine_params", {}))
        kwargs["poolclass"] = pool.NullPool

        connect_args = kwargs.setdefault("connect_args", {})
        uri, connect_args = database.db_engine_spec.adjust_engine_params(
            uri,
            connect_args,
            catalog,
            schema,
        )

        username = database.get_effective_user(uri)
        if username and is_feature_enabled("IMPERSONATE_WITH_EMAIL_PREFIX"):
            user = security_manager.find_user(username=username)
            if user and user.email and "@" in user.email:
                username = user.email.split("@")[0]

        if database.impersonate_user:
            oauth2_config = database.get_oauth2_config()
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

        database.update_params_from_encrypted_extra(kwargs)

        if self.db_connection_mutator:
            source = source or get_query_source_from_request()
            uri, kwargs = self.db_connection_mutator(
                uri,
                kwargs,
                username,
                security_manager,
                source,
            )

        database.db_engine_spec.validate_database_uri(uri)
        return uri, kwargs

    def _create_engine(
        self,
        database: "Database",
        uri: URL,
        kwargs: dict[str, Any],
    ) -> Engine:
        try:
            return create_engine(uri, **kwargs)
        except Exception as ex:
            raise database.db_engine_spec.get_dbapi_mapped_exception(ex) from ex

    def _create_tunnel(self, ssh_tunnel: "SSHTunnel", uri: URL) -> SSHTunnelForwarder:
        kwargs = self._get_tunnel_kwargs(ssh_tunnel, uri)
        tunnel = sshtunnel.open_tunnel(**kwargs)
        tunnel.start()
        return tunnel

    def _get_tunnel_kwargs(self, ssh_tunnel: "SSHTunnel", uri: URL) -> dict[str, Any]:
        from superset.utils.ssh_tunnel import get_default_port

        backend = uri.get_backend_name()
        port = uri.port or get_default_port(backend)
        if not port:
            raise SSHTunnelDatabasePortError()

        kwargs = {
            "ssh_address_or_host": (ssh_tunnel.server_address, ssh_tunnel.server_port),
            "ssh_username": ssh_tunnel.username,
            "remote_bind_address": (uri.host, port),
            "local_bind_address": (self.local_bind_address,),
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

        return kwargs
