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
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import pool
from sqlalchemy.engine.url import make_url

from superset.commands.database.ssh_tunnel.exceptions import SSHTunnelDatabasePortError
from superset.engines.manager import EngineManager


@pytest.fixture
def engine_manager() -> EngineManager:
    @contextmanager
    def dummy_context_manager(
        database: MagicMock,
        catalog: str | None,
        schema: str | None,
    ):
        yield

    return EngineManager(engine_context_manager=dummy_context_manager)


@pytest.fixture
def mock_database() -> MagicMock:
    database = MagicMock()
    database.id = 1
    database.sqlalchemy_uri_decrypted = "trino://"
    database.get_extra.return_value = {"engine_params": {"poolclass": "queue"}}
    database.get_effective_user.return_value = "alice"
    database.impersonate_user = False
    database.update_params_from_encrypted_extra = MagicMock()
    database.db_engine_spec = MagicMock()
    database.db_engine_spec.adjust_engine_params.return_value = (
        make_url("trino://"),
        {"source": "Apache Superset"},
    )
    database.db_engine_spec.validate_database_uri = MagicMock()
    return database


@patch("superset.engines.manager.make_url_safe")
def test_get_engine_args_uses_null_pool(
    mock_make_url: MagicMock,
    engine_manager: EngineManager,
    mock_database: MagicMock,
) -> None:
    mock_make_url.return_value = make_url("trino://")

    _, kwargs = engine_manager._get_engine_args(mock_database, None, None, None, None)

    assert kwargs["poolclass"] is pool.NullPool


@patch("superset.engines.manager.make_url_safe")
def test_get_engine_args_with_impersonation(
    mock_make_url: MagicMock,
    engine_manager: EngineManager,
    mock_database: MagicMock,
) -> None:
    mock_make_url.return_value = make_url("trino://")
    mock_database.impersonate_user = True
    mock_database.get_oauth2_config.return_value = None
    mock_database.db_engine_spec.impersonate_user.return_value = (
        make_url("trino://"),
        {"connect_args": {"user": "alice"}, "poolclass": pool.NullPool},
    )

    engine_manager._get_engine_args(mock_database, None, None, None, None)

    mock_database.db_engine_spec.impersonate_user.assert_called_once()


def test_get_tunnel_kwargs_requires_database_port(
    engine_manager: EngineManager,
) -> None:
    ssh_tunnel = MagicMock()
    ssh_tunnel.server_address = "ssh.example.com"
    ssh_tunnel.server_port = 22
    ssh_tunnel.username = "ssh_user"
    ssh_tunnel.password = None
    ssh_tunnel.private_key = None
    ssh_tunnel.private_key_password = None

    uri = MagicMock()
    uri.port = None
    uri.get_backend_name.return_value = "unknown"

    with patch("superset.utils.ssh_tunnel.get_default_port", return_value=None):
        with pytest.raises(SSHTunnelDatabasePortError):
            engine_manager._get_tunnel_kwargs(ssh_tunnel, uri)
