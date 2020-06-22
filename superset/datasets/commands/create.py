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
from typing import Any, Dict, List, Optional

from flask_appbuilder.models.sqla import Model
from flask_appbuilder.security.sqla.models import User
from marshmallow import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.base import BaseCommand
from superset.commands.utils import populate_owners
from superset.dao.exceptions import DAOCreateFailedError
from superset.datasets.commands.exceptions import (
    DatabaseNotFoundValidationError,
    DatasetCreateFailedError,
    DatasetExistsValidationError,
    DatasetInvalidError,
    TableNotFoundValidationError,
)
from superset.datasets.dao import DatasetDAO
from superset.extensions import db, security_manager

logger = logging.getLogger(__name__)


class CreateDatasetCommand(BaseCommand):
    def __init__(self, user: User, data: Dict[str, Any]):
        self._actor = user
        self._properties = data.copy()

    def run(self) -> Model:
        self.validate()
        try:
            # Creates SqlaTable (Dataset)
            dataset = DatasetDAO.create(self._properties, commit=False)
            # Updates columns and metrics from the dataset
            dataset.fetch_metadata(commit=False)
            # Add datasource access permission
            security_manager.add_permission_view_menu(
                "datasource_access", dataset.get_perm()
            )
            # Add schema access permission if exists
            if dataset.schema:
                security_manager.add_permission_view_menu(
                    "schema_access", dataset.schema_perm
                )
            db.session.commit()
        except (SQLAlchemyError, DAOCreateFailedError) as ex:
            logger.exception(ex)
            db.session.rollback()
            raise DatasetCreateFailedError()
        return dataset

    def validate(self) -> None:
        exceptions = list()
        database_id = self._properties["database"]
        table_name = self._properties["table_name"]
        schema = self._properties.get("schema", "")
        owner_ids: Optional[List[int]] = self._properties.get("owners")

        # Validate uniqueness
        if not DatasetDAO.validate_uniqueness(database_id, table_name):
            exceptions.append(DatasetExistsValidationError(table_name))

        # Validate/Populate database
        database = DatasetDAO.get_database_by_id(database_id)
        if not database:
            exceptions.append(DatabaseNotFoundValidationError())
        self._properties["database"] = database

        # Validate table exists on dataset
        if database and not DatasetDAO.validate_table_exists(
            database, table_name, schema
        ):
            exceptions.append(TableNotFoundValidationError(table_name))

        try:
            owners = populate_owners(self._actor, owner_ids)
            self._properties["owners"] = owners
        except ValidationError as ex:
            exceptions.append(ex)
        if exceptions:
            exception = DatasetInvalidError()
            exception.add_list(exceptions)
            raise exception
