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
import logging
import re
from typing import Any, Dict, List, Optional, Type

from flask import current_app
from flask_babel import gettext as __

from superset.commands.base import BaseCommand
from superset.databases.commands.exceptions import (
    DatabaseNotFoundError,
    NoValidatorConfigFoundError,
    NoValidatorFoundError,
    ValidatorSQL400Error,
    ValidatorSQLError,
    ValidatorSQLUnexpectedError,
)
from superset.databases.dao import DatabaseDAO
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.models.core import Database
from superset.sql_validators import get_validator_by_name
from superset.sql_validators.base import BaseSQLValidator
from superset.utils import core as utils

logger = logging.getLogger(__name__)


class ValidateSQLCommand(BaseCommand):
    def __init__(self, model_id: int, data: Dict[str, Any]):
        self._properties = data.copy()
        self._model_id = model_id
        self._model: Optional[Database] = None
        self._validator: Optional[Type[BaseSQLValidator]] = None

    def run(self) -> List[Dict[str, Any]]:
        """
        Validates a SQL statement

        :return: A List of SQLValidationAnnotation
        :raises: DatabaseNotFoundError, NoValidatorConfigFoundError
          NoValidatorFoundError, ValidatorSQLUnexpectedError, ValidatorSQLError
          ValidatorSQL400Error
        """
        self.validate()
        if not self._validator or not self._model:
            raise ValidatorSQLUnexpectedError()
        sql = self._properties["sql"]
        schema = self._properties.get("schema")
        try:
            timeout = current_app.config["SQLLAB_VALIDATION_TIMEOUT"]
            timeout_msg = f"The query exceeded the {timeout} seconds timeout."
            with utils.timeout(seconds=timeout, error_message=timeout_msg):
                errors = self._validator.validate(sql, schema, self._model)
            return [err.to_dict() for err in errors]
        except Exception as ex:
            logger.exception(ex)
            superset_error = SupersetError(
                message=__(
                    "%(validator)s was unable to check your query.\n"
                    "Please recheck your query.\n"
                    "Exception: %(ex)s",
                    validator=self._validator.name,
                    ex=ex,
                ),
                error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                level=ErrorLevel.ERROR,
            )

            # Return as a 400 if the database error message says we got a 4xx error
            if re.search(r"([\W]|^)4\d{2}([\W]|$)", str(ex)):
                raise ValidatorSQL400Error(superset_error) from ex
            raise ValidatorSQLError(superset_error) from ex

    def validate(self) -> None:
        # Validate/populate model exists
        self._model = DatabaseDAO.find_by_id(self._model_id)
        if not self._model:
            raise DatabaseNotFoundError()

        spec = self._model.db_engine_spec
        validators_by_engine = current_app.config["SQL_VALIDATORS_BY_ENGINE"]
        if not validators_by_engine or spec.engine not in validators_by_engine:
            raise NoValidatorConfigFoundError(
                SupersetError(
                    message=__(
                        "no SQL validator is configured for {}".format(spec.engine)
                    ),
                    error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                    level=ErrorLevel.ERROR,
                ),
            )
        validator_name = validators_by_engine[spec.engine]
        self._validator = get_validator_by_name(validator_name)
        if not self._validator:
            raise NoValidatorFoundError(
                SupersetError(
                    message=__(
                        "No validator named {} found "
                        "(configured for the {} engine)".format(
                            validator_name, spec.engine
                        )
                    ),
                    error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                    level=ErrorLevel.ERROR,
                ),
            )
