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

from typing import Any

import pytest
from pytest_mock import MockerFixture

from superset.commands.database.exceptions import (
    DatabaseOfflineError,
    DatabaseTestConnectionFailedError,
    InvalidParametersError,
)
from superset.commands.database.validate import ValidateDatabaseParametersCommand
from superset.constants import PASSWORD_MASK
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.utils import json
from tests.unit_tests.conftest import with_feature_flags


def test_command(mocker: MockerFixture) -> None:
    """
    Test the happy path of the command.
    """
    user = mocker.MagicMock()
    user.email = "alice@example.org"
    mocker.patch("superset.db_engine_specs.gsheets.g", user=user)
    mocker.patch("superset.db_engine_specs.gsheets.create_engine")

    database = mocker.MagicMock()
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.return_value = True

    DatabaseDAO = mocker.patch("superset.commands.database.validate.DatabaseDAO")  # noqa: N806
    DatabaseDAO.build_db_for_connection_test.return_value = database

    properties = {
        "engine": "gsheets",
        "driver": "gsheets",
        "catalog": {"test": "https://example.org/"},
    }
    command = ValidateDatabaseParametersCommand(properties)
    command.run()


def test_command_invalid(mocker: MockerFixture) -> None:
    """
    Test the command when the payload is invalid.
    """
    user = mocker.MagicMock()
    user.email = "alice@example.org"
    mocker.patch("superset.db_engine_specs.gsheets.g", user=user)
    mocker.patch("superset.db_engine_specs.gsheets.create_engine")

    database = mocker.MagicMock()
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.return_value = True

    DatabaseDAO = mocker.patch("superset.commands.database.validate.DatabaseDAO")  # noqa: N806
    DatabaseDAO.build_db_for_connection_test.return_value = database

    properties = {
        "engine": "gsheets",
        "driver": "gsheets",
        "catalog": {"": "https://example.org/"},
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(InvalidParametersError) as excinfo:
        command.run()
    assert excinfo.value.errors == [
        SupersetError(
            message="Sheet name is required",
            error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
            level=ErrorLevel.WARNING,
            extra={
                "catalog": {"idx": 0, "name": True},
                "issue_codes": [
                    {
                        "code": 1018,
                        "message": (
                            "Issue 1018 - One or more parameters needed to configure a "
                            "database are missing."
                        ),
                    }
                ],
            },
        )
    ]


def test_command_no_ping(mocker: MockerFixture) -> None:
    """
    Test the command when it can't ping the database.
    """
    user = mocker.MagicMock()
    user.email = "alice@example.org"
    mocker.patch("superset.db_engine_specs.gsheets.g", user=user)
    mocker.patch("superset.db_engine_specs.gsheets.create_engine")

    database = mocker.MagicMock()
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.return_value = False

    DatabaseDAO = mocker.patch("superset.commands.database.validate.DatabaseDAO")  # noqa: N806
    DatabaseDAO.build_db_for_connection_test.return_value = database

    properties = {
        "engine": "gsheets",
        "driver": "gsheets",
        "catalog": {"test": "https://example.org/"},
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(DatabaseOfflineError) as excinfo:
        command.run()
    assert excinfo.value.error == SupersetError(
        message="Database is offline.",
        error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
        level=ErrorLevel.ERROR,
        extra={
            "issue_codes": [
                {
                    "code": 1002,
                    "message": "Issue 1002 - The database returned an unexpected error.",  # noqa: E501
                }
            ]
        },
    )


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
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.side_effect = Exception("OAuth2 needed")

    DatabaseDAO = mocker.patch("superset.commands.database.validate.DatabaseDAO")  # noqa: N806
    DatabaseDAO.build_db_for_connection_test.return_value = database

    properties = {
        "engine": "gsheets",
        "driver": "gsheets",
        "catalog": {"test": "https://example.org/"},
    }
    command = ValidateDatabaseParametersCommand(properties)
    command.run()


def test_command_with_oauth2_not_configured(mocker: MockerFixture) -> None:
    """
    Test the command when OAuth2 is needed but not configured in the DB.
    """
    user = mocker.MagicMock()
    user.email = "alice@example.org"
    mocker.patch("superset.db_engine_specs.gsheets.g", user=user)
    mocker.patch("superset.db_engine_specs.gsheets.create_engine")

    database = mocker.MagicMock()
    database.is_oauth2_enabled.return_value = False
    database.db_engine_spec.needs_oauth2.return_value = True
    database.db_engine_spec.extract_errors.return_value = [
        SupersetError(
            error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
            message="OAuth2 is needed but not configured.",
            level=ErrorLevel.ERROR,
            extra={"engine_name": "gsheets"},
        )
    ]
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.side_effect = Exception("OAuth2 needed")

    DatabaseDAO = mocker.patch("superset.commands.database.validate.DatabaseDAO")  # noqa: N806
    DatabaseDAO.build_db_for_connection_test.return_value = database

    properties = {
        "engine": "gsheets",
        "driver": "gsheets",
        "catalog": {"test": "https://example.org/"},
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(DatabaseTestConnectionFailedError) as excinfo:
        command.run()
    assert excinfo.value.errors == [
        SupersetError(
            error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
            message="OAuth2 is needed but not configured.",
            level=ErrorLevel.ERROR,
            extra={"engine_name": "gsheets"},
        )
    ]


def test_command_duplicate_database_name(mocker: MockerFixture) -> None:
    """
    Validation surfaces a duplicate-name error for a new database with a
    name already in use.
    """
    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.validate.DatabaseDAO"
    )
    DatabaseDAO.validate_uniqueness.return_value = False
    mocker.patch(
        "superset.commands.database.validate.get_engine_spec",
        return_value=mocker.MagicMock(
            validate_parameters=mocker.MagicMock(return_value=[]),
        ),
    )

    properties = {
        "engine": "postgresql",
        "database_name": "duplicate",
        "parameters": {
            "host": "localhost",
            "port": 5432,
            "username": "u",
            "database": "d",
        },
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(InvalidParametersError) as excinfo:
        command.run()
    assert any(
        err.error_type == SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR
        and err.extra is not None
        and err.extra.get("invalid") == ["database_name"]
        for err in excinfo.value.errors
    )


def test_command_duplicate_database_name_on_update(mocker: MockerFixture) -> None:
    """
    Validation uses ``validate_update_uniqueness`` when an ``id`` is provided.
    """
    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.validate.DatabaseDAO"
    )
    DatabaseDAO.find_by_id.return_value = mocker.MagicMock()
    DatabaseDAO.validate_update_uniqueness.return_value = False
    mocker.patch(
        "superset.commands.database.validate.get_engine_spec",
        return_value=mocker.MagicMock(
            validate_parameters=mocker.MagicMock(return_value=[]),
        ),
    )

    properties = {
        "id": 1,
        "engine": "postgresql",
        "database_name": "existing",
        "parameters": {
            "host": "localhost",
            "port": 5432,
            "username": "u",
            "database": "d",
        },
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(InvalidParametersError):
        command.run()
    DatabaseDAO.validate_update_uniqueness.assert_called_once_with(1, "existing")


def test_command_duplicate_database_name_bypass_engine(
    mocker: MockerFixture,
) -> None:
    """
    Bypass engines (e.g. ``bigquery``) still validate database name uniqueness.
    """
    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.validate.DatabaseDAO"
    )
    DatabaseDAO.validate_uniqueness.return_value = False

    properties = {
        "engine": "bigquery",
        "database_name": "duplicate",
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(InvalidParametersError) as excinfo:
        command.run()
    assert excinfo.value.errors[0].error_type == (
        SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR
    )


def test_validate_ssh_tunnel_feature_disabled(mocker: MockerFixture) -> None:
    """
    Enabling SSH tunnel without the feature flag surfaces a field-level
    SupersetError tagged with ``ssh_tunnel`` so the modal can map it back
    to the SSH tunnel section instead of throwing a hard 400 toast.
    """
    mocker.patch(
        "superset.commands.database.validate.is_feature_enabled",
        return_value=False,
    )

    properties = {
        "engine": "postgresql",
        "ssh_tunnel": {"server_address": "localhost"},
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(InvalidParametersError) as excinfo:
        command.run()
    assert any(
        err.extra is not None and err.extra.get("ssh_tunnel") is True
        for err in excinfo.value.errors
    )


def test_validate_ssh_tunnel_missing_db_port(mocker: MockerFixture) -> None:
    """
    SSH tunneling requires a database port; the error is surfaced via the
    top-level ``missing`` extra so it lands on the database port input.
    """
    mocker.patch(
        "superset.commands.database.validate.is_feature_enabled",
        return_value=True,
    )
    mocker.patch(
        "superset.commands.database.validate.get_engine_spec",
        return_value=mocker.MagicMock(
            validate_parameters=mocker.MagicMock(return_value=[]),
        ),
    )

    properties = {
        "engine": "postgresql",
        "ssh_tunnel": {"server_address": "localhost"},
        "parameters": {"host": "localhost"},
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(InvalidParametersError) as excinfo:
        command.run()
    assert any(
        err.extra is not None
        and "port" in (err.extra.get("missing") or [])
        and not err.extra.get("ssh_tunnel")
        for err in excinfo.value.errors
    )


def test_get_ssh_tunnel_errors_missing_required_fields(
    mocker: MockerFixture,
) -> None:
    """
    SSH tunnel collects missing required fields (server_address, server_port,
    username) and missing credentials.
    """
    mocker.patch(
        "superset.commands.database.validate.is_feature_enabled",
        return_value=True,
    )
    mocker.patch(
        "superset.commands.database.validate.get_engine_spec",
        return_value=mocker.MagicMock(
            validate_parameters=mocker.MagicMock(return_value=[]),
        ),
    )

    properties = {
        "engine": "postgresql",
        "parameters": {
            "host": "localhost",
            "port": 5432,
            "username": "u",
            "database": "d",
        },
        "ssh_tunnel": {"server_address": "ssh.example.com"},
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(InvalidParametersError) as excinfo:
        command.run()

    assert any(
        err.extra is not None
        and err.extra.get("ssh_tunnel") is True
        and err.extra.get("missing") == ["server_port", "username"]
        for err in excinfo.value.errors
    )
    assert any(
        err.extra is not None
        and err.extra.get("ssh_tunnel") is True
        and err.extra.get("missing") == ["password", "private_key"]
        for err in excinfo.value.errors
    )


def test_get_ssh_tunnel_errors_unencrypted_private_key_is_valid(
    mocker: MockerFixture,
) -> None:
    """
    An unencrypted private key (no ``private_key_password``) is a valid
    SSH tunnel credential — validation should not flag it as missing.
    """
    mocker.patch(
        "superset.commands.database.validate.is_feature_enabled",
        return_value=True,
    )

    database = mocker.MagicMock()
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.return_value = True
    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.validate.DatabaseDAO"
    )
    DatabaseDAO.validate_uniqueness.return_value = True
    DatabaseDAO.build_db_for_connection_test.return_value = database

    mocker.patch(
        "superset.commands.database.validate.get_engine_spec",
        return_value=mocker.MagicMock(
            validate_parameters=mocker.MagicMock(return_value=[]),
            build_sqlalchemy_uri=mocker.MagicMock(return_value="postgresql://"),
            unmask_encrypted_extra=mocker.MagicMock(return_value="{}"),
        ),
    )

    properties = {
        "engine": "postgresql",
        "parameters": {
            "host": "localhost",
            "port": 5432,
            "username": "u",
            "database": "d",
        },
        "ssh_tunnel": {
            "server_address": "ssh.example.com",
            "server_port": 22,
            "username": "ssh-user",
            "private_key": "----- KEY -----",
        },
    }
    command = ValidateDatabaseParametersCommand(properties)
    command.run()


def test_ssh_tunnel_forwarded_to_connection_test(
    mocker: MockerFixture,
) -> None:
    """
    The SSH tunnel payload is forwarded into the connection test so
    tunnel-only databases are reached through the tunnel rather than
    pinged directly.
    """
    mocker.patch(
        "superset.commands.database.validate.is_feature_enabled",
        return_value=True,
    )

    database = mocker.MagicMock()
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.return_value = True
    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.validate.DatabaseDAO"
    )
    DatabaseDAO.validate_uniqueness.return_value = True
    DatabaseDAO.build_db_for_connection_test.return_value = database

    mocker.patch(
        "superset.commands.database.validate.get_engine_spec",
        return_value=mocker.MagicMock(
            validate_parameters=mocker.MagicMock(return_value=[]),
            build_sqlalchemy_uri=mocker.MagicMock(return_value="postgresql://"),
            unmask_encrypted_extra=mocker.MagicMock(return_value="{}"),
        ),
    )

    ssh_tunnel = {
        "server_address": "ssh.example.com",
        "server_port": 22,
        "username": "ssh-user",
        "password": "secret",
    }
    properties = {
        "engine": "postgresql",
        "parameters": {
            "host": "localhost",
            "port": 5432,
            "username": "u",
            "database": "d",
        },
        "ssh_tunnel": ssh_tunnel,
    }
    command = ValidateDatabaseParametersCommand(properties)
    command.run()

    DatabaseDAO.build_db_for_connection_test.assert_called_once()
    assert (
        DatabaseDAO.build_db_for_connection_test.call_args.kwargs["ssh_tunnel"]
        == ssh_tunnel
    )


def test_ssh_tunnel_unmasked_when_only_engine_params_changed(
    mocker: MockerFixture,
) -> None:
    """
    An unrelated `extra.engine_params` change must not block reattaching
    the stored SSH tunnel password when the tunnel's own endpoint is
    unchanged -- gating the tunnel unmask on the combined identity flag
    (rather than the tunnel's own endpoint check) would spuriously fail a
    perfectly legitimate connection test.
    """
    mocker.patch(
        "superset.commands.database.validate.is_feature_enabled",
        return_value=True,
    )

    tunnel = mocker.MagicMock()
    tunnel.server_address = "ssh.example.com"
    tunnel.server_port = 22
    tunnel.password = "real-tunnel-secret"  # noqa: S105

    existing = mocker.MagicMock()
    existing.safe_sqlalchemy_uri.return_value = "postgresql://u:XXXXXXXXXX@host1/d"
    existing.sqlalchemy_uri_decrypted = "postgresql://u:realpass@host1/d"
    existing.encrypted_extra = "{}"
    existing.extra = "{}"
    existing.ssh_tunnel = tunnel

    database = mocker.MagicMock()
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.return_value = True

    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.validate.DatabaseDAO"
    )
    DatabaseDAO.find_by_id.return_value = existing
    DatabaseDAO.validate_update_uniqueness.return_value = True
    DatabaseDAO.build_db_for_connection_test.return_value = database

    mocker.patch(
        "superset.commands.database.validate.get_engine_spec",
        return_value=mocker.MagicMock(
            validate_parameters=mocker.MagicMock(return_value=[]),
            # a fresh (non-masked) password, as if the user supplied the
            # real one for the main connection -- this is the legitimate
            # path that gets past the main URI-identity check below
            build_sqlalchemy_uri=mocker.MagicMock(
                return_value="postgresql://u:realpass@host1/d"
            ),
            unmask_encrypted_extra=mocker.MagicMock(return_value="{}"),
        ),
    )

    properties = {
        "id": 1,
        "engine": "postgresql",
        "parameters": {
            "host": "host1",
            "port": 5432,
            "username": "u",
            "password": "realpass",
            "database": "d",
        },
        # unrelated to the tunnel, but still an identity-affecting change
        "extra": json.dumps(
            {"engine_params": {"connect_args": {"connect_timeout": 30}}}
        ),
        "ssh_tunnel": {
            "server_address": "ssh.example.com",
            "server_port": 22,
            "username": "tunnel_user",
            "password": PASSWORD_MASK,
        },
    }
    command = ValidateDatabaseParametersCommand(properties)
    command.run()

    forwarded_tunnel = DatabaseDAO.build_db_for_connection_test.call_args.kwargs[
        "ssh_tunnel"
    ]
    assert forwarded_tunnel["password"] == "real-tunnel-secret"  # noqa: S105


def test_get_ssh_tunnel_errors_skipped_when_parameters_ssh_false(
    mocker: MockerFixture,
) -> None:
    """
    An explicit ``parameters.ssh == False`` is authoritative and skips SSH
    tunnel validation even when a stale ``ssh_tunnel`` object is still in
    the payload — otherwise toggling SSH off after partial entry would
    leave hidden validation errors blocking save.
    """
    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.validate.DatabaseDAO"
    )
    DatabaseDAO.validate_uniqueness.return_value = True

    database = mocker.MagicMock()
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.return_value = True
    DatabaseDAO.build_db_for_connection_test.return_value = database

    mocker.patch(
        "superset.commands.database.validate.get_engine_spec",
        return_value=mocker.MagicMock(
            validate_parameters=mocker.MagicMock(return_value=[]),
            build_sqlalchemy_uri=mocker.MagicMock(return_value="postgresql://"),
            unmask_encrypted_extra=mocker.MagicMock(return_value="{}"),
        ),
    )

    properties = {
        "engine": "postgresql",
        "database_name": "ok",
        "parameters": {
            "host": "localhost",
            "port": 5432,
            "username": "u",
            "database": "d",
            "ssh": False,
        },
        # Stale partial tunnel payload from before the user toggled off:
        "ssh_tunnel": {"server_address": "ssh.example.com"},
    }
    command = ValidateDatabaseParametersCommand(properties)
    command.run()


def test_get_ssh_tunnel_errors_skipped_when_not_enabled(
    mocker: MockerFixture,
) -> None:
    """
    SSH tunnel validation is a no-op when ssh is not enabled and no tunnel
    is provided.
    """
    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.validate.DatabaseDAO"
    )
    DatabaseDAO.validate_uniqueness.return_value = True

    database = mocker.MagicMock()
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.return_value = True
    DatabaseDAO.build_db_for_connection_test.return_value = database

    mocker.patch(
        "superset.commands.database.validate.get_engine_spec",
        return_value=mocker.MagicMock(
            validate_parameters=mocker.MagicMock(return_value=[]),
            build_sqlalchemy_uri=mocker.MagicMock(return_value="postgresql://"),
            unmask_encrypted_extra=mocker.MagicMock(return_value="{}"),
        ),
    )

    properties = {
        "engine": "postgresql",
        "database_name": "ok",
        "parameters": {
            "host": "localhost",
            "port": 5432,
            "username": "u",
            "database": "d",
        },
    }
    command = ValidateDatabaseParametersCommand(properties)
    command.run()


def test_bypass_engine_surfaces_ssh_tunnel_errors(mocker: MockerFixture) -> None:
    """
    Bypass engines also surface SSH tunnel field errors so the progressive
    validation flow stays consistent across engine types.
    """
    mocker.patch(
        "superset.commands.database.validate.is_feature_enabled",
        return_value=True,
    )
    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.validate.DatabaseDAO"
    )
    DatabaseDAO.validate_uniqueness.return_value = True

    properties = {
        "engine": "snowflake",
        "database_name": "ok",
        "parameters": {"port": 443},
        "ssh_tunnel": {"server_address": "ssh.example.com"},
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(InvalidParametersError) as excinfo:
        command.run()
    assert any(
        err.extra is not None and err.extra.get("ssh_tunnel") is True
        for err in excinfo.value.errors
    )


def test_validate_ssh_tunnel_feature_disabled_via_parameters_ssh(
    mocker: MockerFixture,
) -> None:
    """
    The SSH feature-flag guard fires when the UI marks ``parameters.ssh``
    even if ``ssh_tunnel`` itself is empty during progressive validation.
    """
    mocker.patch(
        "superset.commands.database.validate.is_feature_enabled",
        return_value=False,
    )

    properties = {
        "engine": "postgresql",
        "parameters": {"host": "localhost", "port": 5432, "ssh": True},
        "ssh_tunnel": {},
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(InvalidParametersError) as excinfo:
        command.run()
    assert any(
        err.extra is not None and err.extra.get("ssh_tunnel") is True
        for err in excinfo.value.errors
    )


def test_validate_engine_params_change_requires_new_credentials(
    mocker: MockerFixture,
) -> None:
    """
    Validating an existing database's parameters (unchanged host/port/etc,
    so `sqlalchemy_uri` matches the stored masked URI) must not silently
    reuse the stored password when `extra.engine_params` would redirect the
    actual DBAPI connect kwargs elsewhere.
    """
    existing = mocker.MagicMock()
    existing.safe_sqlalchemy_uri.return_value = "postgresql://u:XXXXXXXXXX@host1/d"
    existing.sqlalchemy_uri_decrypted = "postgresql://u:realpass@host1/d"
    existing.encrypted_extra = "{}"
    existing.extra = "{}"
    existing.ssh_tunnel = None

    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.validate.DatabaseDAO"
    )
    DatabaseDAO.find_by_id.return_value = existing
    DatabaseDAO.validate_update_uniqueness.return_value = True

    mocker.patch(
        "superset.commands.database.validate.get_engine_spec",
        return_value=mocker.MagicMock(
            validate_parameters=mocker.MagicMock(return_value=[]),
            build_sqlalchemy_uri=mocker.MagicMock(
                return_value="postgresql://u:XXXXXXXXXX@host1/d"
            ),
            unmask_encrypted_extra=mocker.MagicMock(return_value="{}"),
        ),
    )

    properties = {
        "id": 1,
        "engine": "postgresql",
        "parameters": {
            "host": "host1",
            "port": 5432,
            "username": "u",
            "database": "d",
        },
        "extra": json.dumps(
            {
                "engine_params": {
                    "connect_args": {"host": "attacker.example.com", "port": 15432}
                }
            }
        ),
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(InvalidParametersError):
        command.run()

    DatabaseDAO.build_db_for_connection_test.assert_not_called()


def test_validate_ssh_tunnel_host_change_requires_new_credentials(
    mocker: MockerFixture,
) -> None:
    """
    Validating with an unchanged host/parameters set must not silently
    reuse the stored SSH tunnel password when the tunnel endpoint itself
    is being redirected.
    """
    mocker.patch(
        "superset.commands.database.validate.is_feature_enabled",
        return_value=True,
    )

    tunnel = mocker.MagicMock()
    tunnel.server_address = "10.0.0.1"
    tunnel.server_port = 22

    existing = mocker.MagicMock()
    existing.safe_sqlalchemy_uri.return_value = "postgresql://u:XXXXXXXXXX@host1/d"
    existing.sqlalchemy_uri_decrypted = "postgresql://u:realpass@host1/d"
    existing.encrypted_extra = "{}"
    existing.extra = "{}"
    existing.ssh_tunnel = tunnel

    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.validate.DatabaseDAO"
    )
    DatabaseDAO.find_by_id.return_value = existing
    DatabaseDAO.validate_update_uniqueness.return_value = True

    mocker.patch(
        "superset.commands.database.validate.get_engine_spec",
        return_value=mocker.MagicMock(
            validate_parameters=mocker.MagicMock(return_value=[]),
            build_sqlalchemy_uri=mocker.MagicMock(
                return_value="postgresql://u:XXXXXXXXXX@host1/d"
            ),
            unmask_encrypted_extra=mocker.MagicMock(return_value="{}"),
        ),
    )

    properties = {
        "id": 1,
        "engine": "postgresql",
        "parameters": {
            "host": "host1",
            "port": 5432,
            "username": "u",
            "database": "d",
        },
        "ssh_tunnel": {
            "server_address": "attacker.example.com",
            "server_port": 22,
            "username": "tunnel_user",
            "password": PASSWORD_MASK,
        },
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(InvalidParametersError):
        command.run()

    DatabaseDAO.build_db_for_connection_test.assert_not_called()


def test_ssh_tunnel_missing_message_is_interpolated(
    mocker: MockerFixture,
) -> None:
    """
    The translated ``parameters are missing`` message is interpolated with
    the actual missing fields rather than the raw ``%(missing)s`` token.
    """
    mocker.patch(
        "superset.commands.database.validate.is_feature_enabled",
        return_value=True,
    )
    mocker.patch(
        "superset.commands.database.validate.get_engine_spec",
        return_value=mocker.MagicMock(
            validate_parameters=mocker.MagicMock(return_value=[]),
        ),
    )

    properties = {
        "engine": "postgresql",
        "parameters": {
            "host": "localhost",
            "port": 5432,
            "username": "u",
            "database": "d",
        },
        "ssh_tunnel": {"server_address": "ssh.example.com"},
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(InvalidParametersError) as excinfo:
        command.run()
    missing_field_messages = [
        err.message
        for err in excinfo.value.errors
        if err.extra is not None
        and err.extra.get("missing")
        and err.extra.get("ssh_tunnel")  # noqa: E501
    ]
    assert missing_field_messages
    assert all("%(missing)s" not in msg for msg in missing_field_messages)
    assert any("server_port" in msg for msg in missing_field_messages)


@pytest.mark.parametrize(
    "credentials",
    [
        {"username": "embedded_svc"},
        {"password": "pw"},
        {"username": "embedded_svc", "password": ""},
        {"username": "   ", "password": "pw"},
        {"username": " \t ", "auth_method": "keypair", "privatekey_body": "PEM"},
        {"username": "embedded_svc", "auth_method": "keypair"},
        {"auth_method": "keypair", "privatekey_body": "-----BEGIN-----"},
    ],
)
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_incomplete_embedded_credentials_from_the_dialog(
    mocker: MockerFixture,
    credentials: dict[str, str],
) -> None:
    """
    An incomplete embedded credential is rejected rather than silently stored.

    ``Database.get_embedded_fallback_credentials`` ignores a credential that is
    not complete for its auth method, so saving one leaves a setting that reads as
    configured and never applies. Snowflake is a bypass engine, so this has to be
    collected alongside the database-name and SSH-tunnel errors rather than in
    ``validate_parameters``.

    The connection dialog validates before it folds ``x-encrypted-extra``
    parameters into ``masked_encrypted_extra``, so the value arrives here under
    ``parameters``.
    """
    mocker.patch("superset.commands.database.validate.DatabaseDAO")

    properties = {
        "engine": "snowflake",
        "parameters": {"embedded_credentials": credentials},
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(InvalidParametersError) as excinfo:
        command.run()

    error = excinfo.value.errors[0]
    assert error.error_type == SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR
    # `INVALID_PAYLOAD_SCHEMA_ERROR` is on the blur-time allowlist in
    # `useDatabaseValidation`, and `extra.invalid` is what maps the message onto
    # the matching form field, so the user sees it before pressing Connect.
    assert error.extra["invalid"] == ["embedded_credentials"]


@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_incomplete_embedded_credentials_from_the_api(mocker: MockerFixture) -> None:
    """
    A direct API caller posts the credential inside ``masked_encrypted_extra``.
    """
    mocker.patch("superset.commands.database.validate.DatabaseDAO")

    properties = {
        "engine": "snowflake",
        "masked_encrypted_extra": json.dumps(
            {"embedded_credentials": {"username": "embedded_svc", "password": ""}}
        ),
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(InvalidParametersError) as excinfo:
        command.run()

    assert excinfo.value.errors[0].extra["invalid"] == ["embedded_credentials"]


def _pem(passphrase: str) -> str:
    """A freshly generated RSA private key, PEM-encoded under ``passphrase``."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    encryption = (
        serialization.BestAvailableEncryption(passphrase.encode())
        if passphrase
        else serialization.NoEncryption()
    )
    return (
        rsa.generate_private_key(public_exponent=65537, key_size=2048)
        .private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            encryption,
        )
        .decode()
    )


@pytest.mark.parametrize(
    "credentials",
    [
        {"username": "embedded_svc", "password": "pw"},
        # The edit flow posts the secrets back as the backend's mask.
        {"username": "embedded_svc", "password": PASSWORD_MASK},
        {
            "username": "embedded_svc",
            "auth_method": "keypair",
            "privatekey_body": _pem(""),
        },
        {
            "username": "embedded_svc",
            "auth_method": "keypair",
            "privatekey_body": PASSWORD_MASK,
            "privatekey_pass": PASSWORD_MASK,
        },
        {},
        None,
    ],
)
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_complete_or_absent_embedded_credentials_pass(
    mocker: MockerFixture,
    credentials: dict[str, str] | None,
) -> None:
    """
    Complete, empty and absent credentials are all acceptable.
    """
    mocker.patch("superset.commands.database.validate.DatabaseDAO")

    properties = {
        "engine": "snowflake",
        "parameters": {"embedded_credentials": credentials},
    }
    ValidateDatabaseParametersCommand(properties).run()


@pytest.mark.parametrize(
    "credentials",
    [
        {"username": "embedded_svc", "password": PASSWORD_MASK},
        {
            "username": "embedded_svc",
            "auth_method": "keypair",
            "privatekey_body": PASSWORD_MASK,
        },
        "",
        {},
        None,
    ],
)
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_embedded_credential_edits_replace_an_imported_partial_value(
    mocker: MockerFixture, credentials: dict[str, str] | str | None
) -> None:
    """Validate the edited value rather than the stale imported credential."""
    from superset.databases.schemas import DatabaseValidateParametersSchema

    mocker.patch("superset.commands.database.validate.DatabaseDAO")
    properties = DatabaseValidateParametersSchema().load(
        {
            "engine": "snowflake",
            "configuration_method": "dynamic_form",
            "parameters": {"embedded_credentials": credentials},
            "masked_encrypted_extra": json.dumps(
                {"embedded_credentials": {"username": "embedded_svc"}}
            ),
        }
    )
    ValidateDatabaseParametersCommand(properties).run()


@pytest.mark.parametrize(
    "disabled_flag", ["EMBEDDED_CREDENTIAL_FALLBACK", "EMBEDDED_SUPERSET"]
)
def test_disabled_embedded_credentials_do_not_block_parameter_validation(
    mocker: MockerFixture, disabled_flag: str
) -> None:
    """A hidden partial credential must not block testing an unrelated edit."""
    mocker.patch(
        "superset.extensions.feature_flag_manager.get_feature_flags",
        return_value={
            "EMBEDDED_CREDENTIAL_FALLBACK": True,
            "EMBEDDED_SUPERSET": True,
            disabled_flag: False,
        },
    )
    mocker.patch("superset.commands.database.validate.DatabaseDAO")
    ValidateDatabaseParametersCommand(
        {
            "engine": "snowflake",
            "masked_encrypted_extra": json.dumps(
                {"embedded_credentials": {"username": "embedded_svc"}}
            ),
        }
    ).run()


@pytest.mark.parametrize("source", ["parameters", "masked_encrypted_extra"])
@pytest.mark.parametrize("credentials", ["not json", "[]", "42", [], False, 0])
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_bypass_engine_rejects_malformed_embedded_credentials(
    mocker: MockerFixture, source: str, credentials: Any
) -> None:
    """Snowflake's bypass cannot skip malformed embedded credential checks."""
    mocker.patch("superset.commands.database.validate.DatabaseDAO")
    value = {"embedded_credentials": credentials}
    properties = {
        "engine": "snowflake",
        source: value if source == "parameters" else json.dumps(value),
    }
    with pytest.raises(InvalidParametersError) as excinfo:
        ValidateDatabaseParametersCommand(properties).run()
    error = excinfo.value.errors[0]
    assert error.extra["invalid"] == ["embedded_credentials"]
    assert "invalid or incomplete" in error.message


@pytest.mark.parametrize("source", ["parameters", "masked_encrypted_extra"])
@pytest.mark.parametrize("valid", [True, False])
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_parameter_validation_uses_the_engine_credential_validator(
    mocker: MockerFixture, source: str, valid: bool
) -> None:
    """Custom credentials use the query-time hook even on bypass engines."""
    from superset.db_engine_specs.snowflake import SnowflakeEngineSpec

    class TokenEngineSpec(SnowflakeEngineSpec):
        @classmethod
        def validate_embedded_credentials(
            cls, credentials: Any
        ) -> dict[str, str] | None:
            if isinstance(credentials, dict) and credentials.get("token"):
                return credentials
            return None

    mocker.patch("superset.commands.database.validate.DatabaseDAO")
    mocker.patch(
        "superset.commands.database.validate.get_engine_spec",
        return_value=TokenEngineSpec,
    )
    credentials = (
        {"token": "engine-token"} if valid else {"username": "svc", "password": "pw"}
    )
    value = {"embedded_credentials": json.dumps(credentials)}
    properties = {
        "engine": "snowflake",
        source: value if source == "parameters" else json.dumps(value),
    }
    command = ValidateDatabaseParametersCommand(properties)
    if valid:
        command.run()
    else:
        with pytest.raises(InvalidParametersError):
            command.run()


@pytest.mark.parametrize(
    "privatekey_body, privatekey_pass",
    [
        (_pem("key passphrase"), "wrong passphrase"),
        ("-----BEGIN PRIVATE KEY-----", ""),
    ],
)
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_an_unreadable_embedded_key_is_reported_on_its_field(
    mocker: MockerFixture, privatekey_body: str, privatekey_pass: str
) -> None:
    """
    The dialog validates before saving, so an unreadable key is reported on the
    embedded credential field there too, without quoting the key (sc-130269).
    """
    mocker.patch("superset.commands.database.validate.DatabaseDAO")

    properties = {
        "engine": "snowflake",
        "parameters": {
            "embedded_credentials": {
                "username": "embedded_svc",
                "auth_method": "keypair",
                "privatekey_body": privatekey_body,
                "privatekey_pass": privatekey_pass,
            }
        },
    }
    with pytest.raises(InvalidParametersError) as excinfo:
        ValidateDatabaseParametersCommand(properties).run()

    error = excinfo.value.errors[0]
    assert error.extra["invalid"] == ["embedded_credentials"]
    assert "private key could not be read" in error.message
    for secret in (privatekey_body, privatekey_pass):
        if secret:
            assert secret not in error.message
