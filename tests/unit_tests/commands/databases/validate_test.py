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

from superset.commands.database.exceptions import (
    DatabaseOfflineError,
    DatabaseTestConnectionFailedError,
    InvalidParametersError,
)
from superset.commands.database.validate import ValidateDatabaseParametersCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType


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
