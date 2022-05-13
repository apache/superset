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
import json
from contextlib import closing
from typing import Any, Dict, Optional

from flask_appbuilder.security.sqla.models import User
from flask_babel import gettext as __

from superset.commands.base import BaseCommand
from superset.databases.commands.exceptions import (
    DatabaseOfflineError,
    DatabaseTestConnectionFailedError,
    InvalidEngineError,
    InvalidParametersError,
)
from superset.databases.dao import DatabaseDAO
from superset.databases.utils import make_url_safe
from superset.db_engine_specs import get_engine_specs
from superset.db_engine_specs.base import BasicParametersMixin
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.extensions import event_logger
from superset.models.core import Database
from superset.utils.core import override_user

BYPASS_VALIDATION_ENGINES = {"bigquery"}


class ValidateDatabaseParametersCommand(BaseCommand):
    def __init__(self, user: User, parameters: Dict[str, Any]):
        self._actor = user
        self._properties = parameters.copy()
        self._model: Optional[Database] = None

    def run(self) -> None:
        engine = self._properties["engine"]
        engine_specs = get_engine_specs()

        if engine in BYPASS_VALIDATION_ENGINES:
            # Skip engines that are only validated onCreate
            return

        if engine not in engine_specs:
            raise InvalidEngineError(
                SupersetError(
                    message=__(
                        'Engine "%(engine)s" is not a valid engine.',
                        engine=engine,
                    ),
                    error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                    level=ErrorLevel.ERROR,
                    extra={"allowed": list(engine_specs), "provided": engine},
                ),
            )
        engine_spec = engine_specs[engine]
        if not hasattr(engine_spec, "parameters_schema"):
            raise InvalidEngineError(
                SupersetError(
                    message=__(
                        'Engine "%(engine)s" cannot be configured through parameters.',
                        engine=engine,
                    ),
                    error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                    level=ErrorLevel.ERROR,
                    extra={
                        "allowed": [
                            name
                            for name, engine_spec in engine_specs.items()
                            if issubclass(engine_spec, BasicParametersMixin)
                        ],
                        "provided": engine,
                    },
                ),
            )

        # perform initial validation
        errors = engine_spec.validate_parameters(  # type: ignore
            self._properties.get("parameters", {})
        )
        if errors:
            event_logger.log_with_context(action="validation_error", engine=engine)
            raise InvalidParametersError(errors)

        serialized_encrypted_extra = self._properties.get("encrypted_extra", "{}")
        try:
            encrypted_extra = json.loads(serialized_encrypted_extra)
        except json.decoder.JSONDecodeError:
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
            encrypted_extra=serialized_encrypted_extra,
        )
        database.set_sqlalchemy_uri(sqlalchemy_uri)
        database.db_engine_spec.mutate_db_for_connection_test(database)

        with override_user(self._actor):
            engine = database.get_sqla_engine()
            try:
                with closing(engine.raw_connection()) as conn:
                    alive = engine.dialect.do_ping(conn)
            except Exception as ex:
                url = make_url_safe(sqlalchemy_uri)
                context = {
                    "hostname": url.host,
                    "password": url.password,
                    "port": url.port,
                    "username": url.username,
                    "database": url.database,
                }
                errors = database.db_engine_spec.extract_errors(ex, context)
                raise DatabaseTestConnectionFailedError(errors) from ex

        if not alive:
            raise DatabaseOfflineError(
                SupersetError(
                    message=__("Database is offline."),
                    error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                    level=ErrorLevel.ERROR,
                ),
            )

    def validate(self) -> None:
        database_name = self._properties.get("database_name")
        if database_name is not None:
            self._model = DatabaseDAO.get_database_by_name(database_name)
