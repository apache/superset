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
from functools import partial
from typing import Any

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.commands.base import BaseCommand, CreateMixin
from superset.commands.dataset.exceptions import (
    DatabaseNotFoundValidationError,
    DatasetCreateFailedError,
    DatasetDataAccessIsNotAllowed,
    DatasetExistsValidationError,
    DatasetInvalidError,
    DatasetSoftDeletedTwinExistsError,
    TableNotFoundValidationError,
)
from superset.commands.utils import populate_subjects
from superset.daos.dataset import DatasetDAO
from superset.db_engine_specs.exceptions import (
    SupersetDBAPIConnectionError,
    SupersetDBAPIDatabaseError,
    SupersetDBAPIOperationalError,
)
from superset.exceptions import (
    OAuth2RedirectError,
    SupersetException,
    SupersetParseError,
    SupersetSecurityException,
    SupersetTimeoutException,
)
from superset.extensions import security_manager
from superset.sql.parse import Table
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateDatasetCommand(CreateMixin, BaseCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=DatasetCreateFailedError))
    def run(self) -> Model:
        self.validate()

        dataset = DatasetDAO.create(attributes=self._properties)
        try:
            dataset.fetch_metadata()
        except OAuth2RedirectError:
            # Must reach the caller unchanged to start the OAuth2 dance.
            raise
        except (
            SupersetTimeoutException,
            SupersetDBAPIConnectionError,
            SupersetDBAPIOperationalError,
            SupersetDBAPIDatabaseError,
        ):
            # Infra-level failures (unreachable database, query timeout), not
            # bad user input: let them propagate with their own status
            # instead of being coerced into a 422 "invalid table" error.
            raise
        except SupersetException as ex:
            # Not a SQLAlchemyError, so ``on_error`` re-raises it untouched and
            # it escapes to FAB's ``@safe`` as an opaque 500 "Fatal error".
            # Deliberately covers the 403 ``SupersetSecurityException`` raised
            # for mutation/multi-statement SQL too: ``validate()`` already
            # reports that class of rejection as a 422 on ``sql`` via
            # ``DatasetDataAccessIsNotAllowed``.
            raise DatasetInvalidError(
                exceptions=[
                    ValidationError(
                        # ``lazy_gettext`` messages aren't ``str``, so
                        # marshmallow won't wrap them into a list on its own.
                        [str(ex.message)],
                        field_name="sql" if self._properties.get("sql") else "table",
                    )
                ]
            ) from ex
        return dataset

    def validate(self) -> None:  # noqa: C901
        exceptions: list[ValidationError] = []
        database_id = self._properties["database"]
        catalog = self._properties.get("catalog")
        schema = self._properties.get("schema")
        table_name = self._properties["table_name"]
        sql = self._properties.get("sql")

        # Validate/Populate database
        database = DatasetDAO.get_database_by_id(database_id)
        if not database:
            exceptions.append(DatabaseNotFoundValidationError())
        self._properties["database"] = database

        # Validate uniqueness
        if database:
            if not catalog:
                catalog = self._properties["catalog"] = database.get_default_catalog()

            table = Table(table_name, schema, catalog)

            if not DatasetDAO.validate_uniqueness(database, table):
                # Distinguish the hidden-twin case: uniqueness fails while
                # the caller's dataset list looks empty. Raise the targeted
                # 422 (naming the twin's uuid and the restore endpoint)
                # instead of the opaque "already exists".
                if soft_twin := DatasetDAO.find_soft_deleted_logical_duplicate(
                    database, table
                ):
                    raise DatasetSoftDeletedTwinExistsError(str(soft_twin.uuid))
                exceptions.append(DatasetExistsValidationError(table))

        # Validate table exists on dataset if sql is not provided
        # This should be validated when the dataset is physical
        if (
            database
            and not sql
            and not DatasetDAO.validate_table_exists(database, table)
        ):
            exceptions.append(TableNotFoundValidationError(table))

        if sql:
            try:
                security_manager.raise_for_access(
                    database=database,
                    sql=sql,
                    catalog=catalog,
                    schema=schema,
                )
            except SupersetSecurityException as ex:
                exceptions.append(DatasetDataAccessIsNotAllowed(ex.error.message))
            except SupersetParseError as ex:
                exceptions.append(
                    ValidationError(
                        f"Invalid SQL: {ex.error.message}",
                        field_name="sql",
                    )
                )
        elif database:
            try:
                security_manager.raise_for_access(
                    database=database,
                    table=table,
                )
            except SupersetSecurityException as ex:
                exceptions.append(DatasetDataAccessIsNotAllowed(ex.error.message))

        # Datasets have editors only — there is no ``sqlatable_viewers`` table,
        # so a ``viewers`` key would be dropped by the DAO's ``setattr`` loop.
        populate_subjects(self._properties, exceptions, include_viewers=False)

        if exceptions:
            raise DatasetInvalidError(exceptions=exceptions)
