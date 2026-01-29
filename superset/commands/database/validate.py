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
from contextlib import closing
from typing import Any, Optional

from flask_babel import gettext as __

from superset import is_feature_enabled
from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import (
    DatabaseOfflineError,
    DatabaseTestConnectionFailedError,
    InvalidEngineError,
    InvalidParametersError,
)
from superset.commands.database.ssh_tunnel.exceptions import (
    SSHTunnelDatabasePortError,
    SSHTunnelingNotEnabledError,
)
from superset.daos.database import DatabaseDAO
from superset.databases.utils import make_url_safe
from superset.db_engine_specs import get_engine_spec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.extensions import event_logger
from superset.models.core import Database
from superset.utils import json

BYPASS_VALIDATION_ENGINES = {"bigquery", "snowflake"}


class ValidateDatabaseParametersCommand(BaseCommand):
    def __init__(self, properties: dict[str, Any]):
        self._properties = properties.copy()
        self._model: Optional[Database] = None

    def run(self) -> None:  # noqa: C901
        self.validate()

        engine = self._properties["engine"]
        driver = self._properties.get("driver")

        if engine in BYPASS_VALIDATION_ENGINES:
            # Skip engines that are only validated onCreate
            # But still validate database_name uniqueness
            self._validate_database_name()
            return

        engine_spec = get_engine_spec(engine, driver)
        if not hasattr(engine_spec, "parameters_schema"):
            raise InvalidEngineError(
                SupersetError(
                    message=__(
                        'Engine "%(engine)s" cannot be configured through parameters.',
                        engine=engine,
                    ),
                    error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                    level=ErrorLevel.ERROR,
                ),
            )

        # perform initial validation (host, port, database, username)
        errors = engine_spec.validate_parameters(self._properties)  # type: ignore

        # Collect database_name errors along with parameter errors
        if database_name_error := self._get_database_name_error():
            errors.append(database_name_error)

        # Collect SSH tunnel errors
        ssh_tunnel_errors = self._get_ssh_tunnel_errors()
        errors.extend(ssh_tunnel_errors)

        if errors:
            event_logger.log_with_context(action="validation_error", engine=engine)
            raise InvalidParametersError(errors)

        serialized_encrypted_extra = self._properties.get(
            "masked_encrypted_extra",
            "{}",
        )
        if self._model:
            serialized_encrypted_extra = engine_spec.unmask_encrypted_extra(
                self._model.encrypted_extra,
                serialized_encrypted_extra,
            )
        try:
            encrypted_extra = json.loads(serialized_encrypted_extra)
        except json.JSONDecodeError:
            encrypted_extra = {}

        # try to connect
        sqlalchemy_uri = engine_spec.build_sqlalchemy_uri(  # type: ignore
            self._properties.get("parameters"),
            encrypted_extra,
        )
        if self._model and sqlalchemy_uri == self._model.safe_sqlalchemy_uri():
            sqlalchemy_uri = self._model.sqlalchemy_uri_decrypted
        database = DatabaseDAO.build_db_for_connection_test(
            server_cert=self._properties.get("server_cert", ""),
            extra=self._properties.get("extra", "{}"),
            impersonate_user=self._properties.get("impersonate_user", False),
            encrypted_extra=json.dumps(encrypted_extra),
        )
        database.set_sqlalchemy_uri(sqlalchemy_uri)
        database.db_engine_spec.mutate_db_for_connection_test(database)

        alive = False
        with database.get_sqla_engine() as engine:
            try:
                with closing(engine.raw_connection()) as conn:
                    alive = engine.dialect.do_ping(conn)
            except Exception as ex:
                # If the connection failed because OAuth2 is needed, we can save the
                # database and trigger the OAuth2 flow whenever a user tries to run a
                # query.
                if (
                    database.is_oauth2_enabled()
                    and database.db_engine_spec.needs_oauth2(ex)
                ):
                    return

                url = make_url_safe(sqlalchemy_uri)
                context = {
                    "hostname": url.host,
                    "password": url.password,
                    "port": url.port,
                    "username": url.username,
                    "database": url.database,
                }
                errors = database.db_engine_spec.extract_errors(
                    ex, context, database_name=database.unique_name
                )
                raise DatabaseTestConnectionFailedError(errors, status=400) from ex

        if not alive:
            raise DatabaseOfflineError(
                SupersetError(
                    message=__("Database is offline."),
                    error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                    level=ErrorLevel.ERROR,
                ),
            )

    def _load_model(self) -> None:
        """Load the existing database model if updating."""
        if (database_id := self._properties.get("id")) is not None:
            self._model = DatabaseDAO.find_by_id(database_id)

    def _get_database_name_error(self) -> Optional[SupersetError]:
        """Check for duplicate database name and return error if found."""
        database_id = self._properties.get("id")

        if database_name := self._properties.get("database_name"):
            is_unique = (
                DatabaseDAO.validate_update_uniqueness(database_id, database_name)
                if database_id is not None
                else DatabaseDAO.validate_uniqueness(database_name)
            )
            if not is_unique:
                return SupersetError(
                    message=__("A database with the same name already exists."),
                    error_type=SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR,
                    level=ErrorLevel.ERROR,
                    extra={"invalid": ["database_name"]},
                )
        return None

    def _validate_database_name(self) -> None:
        """Check for duplicate database name and raise if found."""
        if error := self._get_database_name_error():
            raise InvalidParametersError([error])

    def validate(self) -> None:
        """Load the model and validate SSH tunnel if enabled."""
        self._load_model()
        self._validate_ssh_tunnel()

    def _validate_ssh_tunnel(self) -> None:
        """Validate SSH tunnel configuration if enabled."""
        ssh_tunnel = self._properties.get("ssh_tunnel")
        if ssh_tunnel:
            if not is_feature_enabled("SSH_TUNNELING"):
                raise SSHTunnelingNotEnabledError()
            # Check if port is provided (required for SSH tunneling)
            parameters = self._properties.get("parameters", {})
            if not parameters.get("port"):
                raise SSHTunnelDatabasePortError()

    def _get_ssh_tunnel_errors(self) -> list[SupersetError]:
        """Validate SSH tunnel fields and return list of errors."""
        errors: list[SupersetError] = []
        ssh_tunnel = self._properties.get("ssh_tunnel") or {}
        parameters = self._properties.get("parameters", {})

        # Check if SSH is enabled via parameters.ssh flag
        ssh_enabled = parameters.get("ssh", False)

        # Only validate SSH tunnel if SSH is enabled or ssh_tunnel is provided
        if not ssh_enabled and not ssh_tunnel:
            return errors

        # Required fields
        required_fields = ["server_address", "server_port", "username"]
        missing = [f for f in required_fields if not ssh_tunnel.get(f)]

        if missing:
            errors.append(
                SupersetError(
                    message=__("One or more parameters are missing: %(missing)s"),
                    error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
                    level=ErrorLevel.WARNING,
                    extra={"missing": missing, "ssh_tunnel": True},
                )
            )

        # Either password or private_key is required
        has_password = bool(ssh_tunnel.get("password"))
        has_private_key = bool(ssh_tunnel.get("private_key"))

        if not has_password and not has_private_key:
            errors.append(
                SupersetError(
                    message=__("Must provide credentials for the SSH Tunnel"),
                    error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
                    level=ErrorLevel.WARNING,
                    extra={"missing": ["password"], "ssh_tunnel": True},
                )
            )

        # If private_key is provided, private_key_password is required
        if has_private_key and not ssh_tunnel.get("private_key_password"):
            errors.append(
                SupersetError(
                    message=__("One or more parameters are missing: %(missing)s"),
                    error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
                    level=ErrorLevel.WARNING,
                    extra={"missing": ["private_key_password"], "ssh_tunnel": True},
                )
            )

        return errors
