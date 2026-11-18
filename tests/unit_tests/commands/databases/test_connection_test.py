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

import pytest
from pytest_mock import MockerFixture

from superset.commands.database.test_connection import TestConnectionDatabaseCommand
from superset.constants import PASSWORD_MASK
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import OAuth2RedirectError


def test_ssh_tunnel_unmasked_when_only_engine_params_changed(
    mocker: MockerFixture,
) -> None:
    """
    An unrelated `extra.engine_params` change must not block reattaching
    the stored SSH tunnel password when the tunnel's own endpoint is
    unchanged -- gating the tunnel unmask on the combined identity flag
    (rather than the tunnel's own endpoint check) would spuriously break a
    perfectly legitimate connection test.
    """
    mocker.patch(
        "superset.commands.database.test_connection.is_feature_enabled",
        return_value=True,
    )

    tunnel = mocker.MagicMock()
    tunnel.server_address = "ssh.example.com"
    tunnel.server_port = 22
    tunnel.password = "real-tunnel-secret"  # noqa: S105

    existing = mocker.MagicMock()
    existing.safe_sqlalchemy_uri.return_value = "postgresql://u:XXXXXXXXXX@host1:5432/d"
    existing.extra = "{}"
    existing.ssh_tunnel = tunnel

    database = mocker.MagicMock()
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.return_value = True

    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.test_connection.DatabaseDAO"
    )
    DatabaseDAO.get_database_by_name.return_value = existing
    DatabaseDAO.build_db_for_connection_test.return_value = database

    properties = {
        "database_name": "victim",
        # a fresh (non-masked) URI password, as if the user supplied the
        # real one -- this is the legitimate path that gets past the main
        # URI-identity check
        "sqlalchemy_uri": "postgresql://u:realpass@host1:5432/d",
        # unrelated to the tunnel, but still an identity-affecting change
        "extra": '{"engine_params": {"connect_args": {"connect_timeout": 30}}}',
        "ssh_tunnel": {
            "server_address": "ssh.example.com",
            "server_port": 22,
            "username": "tunnel_user",
            "password": PASSWORD_MASK,
        },
    }
    command = TestConnectionDatabaseCommand(properties)
    command.run()

    forwarded_tunnel = DatabaseDAO.build_db_for_connection_test.call_args.kwargs[
        "ssh_tunnel"
    ]
    assert forwarded_tunnel["password"] == "real-tunnel-secret"  # noqa: S105


def test_command(mocker: MockerFixture) -> None:
    """
    Test the happy path of the command.
    """
    user = mocker.MagicMock()
    user.email = "alice@example.org"
    mocker.patch("superset.db_engine_specs.gsheets.g", user=user)
    mocker.patch("superset.db_engine_specs.gsheets.create_engine")

    database = mocker.MagicMock()
    database.db_engine_spec.__name__ = "GSheetsEngineSpec"
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.return_value = True

    DatabaseDAO = mocker.patch("superset.commands.database.test_connection.DatabaseDAO")  # noqa: N806
    DatabaseDAO.build_db_for_connection_test.return_value = database

    properties = {
        "sqlalchemy_uri": "gsheets://",
        "engine": "gsheets",
        "driver": "gsheets",
        "catalog": {"test": "https://example.org/"},
    }
    command = TestConnectionDatabaseCommand(properties)
    command.run()


def test_command_with_oauth2(mocker: MockerFixture) -> None:
    """
    Test the command when OAuth2 is needed.
    """
    user = mocker.MagicMock()
    user.email = "alice@example.org"
    mocker.patch("superset.db_engine_specs.gsheets.g", user=user)
    mocker.patch("superset.db_engine_specs.gsheets.create_engine")

    database = mocker.MagicMock()
    database.is_oauth2_enabled.return_value = True
    database.db_engine_spec.needs_oauth2.return_value = True
    database.start_oauth2_dance.side_effect = OAuth2RedirectError(
        "url",
        "tab_id",
        "redirect_uri",
    )
    database.db_engine_spec.__name__ = "GSheetsEngineSpec"
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.side_effect = Exception("OAuth2 needed")

    DatabaseDAO = mocker.patch("superset.commands.database.test_connection.DatabaseDAO")  # noqa: N806
    DatabaseDAO.build_db_for_connection_test.return_value = database

    properties = {
        "sqlalchemy_uri": "gsheets://",
        "engine": "gsheets",
        "driver": "gsheets",
        "catalog": {"test": "https://example.org/"},
    }
    command = TestConnectionDatabaseCommand(properties)
    with pytest.raises(OAuth2RedirectError) as excinfo:
        command.run()
    assert excinfo.value.error == SupersetError(
        message="You don't have permission to access the data.",
        error_type=SupersetErrorType.OAUTH2_REDIRECT,
        level=ErrorLevel.WARNING,
        extra={"url": "url", "tab_id": "tab_id", "redirect_uri": "redirect_uri"},
    )
