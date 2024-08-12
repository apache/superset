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
from flask_babel import gettext as __
from marshmallow import ValidationError

from superset.commands.base import BaseCommand, CreateMixin
from superset.commands.dataset.exceptions import (
    DatasetDuplicateFailedError,
    DatasetExistsValidationError,
    DatasetInvalidError,
    DatasetNotFoundError,
)
from superset.commands.exceptions import DatasourceTypeInvalidError
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.daos.dataset import DatasetDAO
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetErrorException
from superset.extensions import db
from superset.models.core import Database
from superset.sql_parse import ParsedQuery, Table
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class DuplicateDatasetCommand(CreateMixin, BaseCommand):
    def __init__(self, data: dict[str, Any]) -> None:
        self._base_model: SqlaTable = SqlaTable()
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=DatasetDuplicateFailedError))
    def run(self) -> Model:
        self.validate()
        database_id = self._base_model.database_id
        table_name = self._properties["table_name"]
        owners = self._properties["owners"]
        database = db.session.query(Database).get(database_id)
        if not database:
            raise SupersetErrorException(
                SupersetError(
                    message=__("The database was not found."),
                    error_type=SupersetErrorType.DATABASE_NOT_FOUND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=404,
            )
        table = SqlaTable(table_name=table_name, owners=owners)
        table.database = database
        table.schema = self._base_model.schema
        table.template_params = self._base_model.template_params
        table.normalize_columns = self._base_model.normalize_columns
        table.always_filter_main_dttm = self._base_model.always_filter_main_dttm
        table.is_sqllab_view = True
        table.sql = ParsedQuery(
            self._base_model.sql,
            engine=database.db_engine_spec.engine,
        ).stripped()
        db.session.add(table)
        cols = []
        for config_ in self._base_model.columns:
            column_name = config_.column_name
            col = TableColumn(
                column_name=column_name,
                verbose_name=config_.verbose_name,
                expression=config_.expression,
                filterable=True,
                groupby=True,
                is_dttm=config_.is_dttm,
                type=config_.type,
                description=config_.description,
            )
            cols.append(col)
        table.columns = cols
        mets = []
        for config_ in self._base_model.metrics:
            metric_name = config_.metric_name
            met = SqlMetric(
                metric_name=metric_name,
                verbose_name=config_.verbose_name,
                expression=config_.expression,
                metric_type=config_.metric_type,
                description=config_.description,
            )
            mets.append(met)
        table.metrics = mets
        return table

    def validate(self) -> None:
        exceptions: list[ValidationError] = []
        base_model_id = self._properties["base_model_id"]
        duplicate_name = self._properties["table_name"]

        base_model = DatasetDAO.find_by_id(base_model_id)
        if not base_model:
            exceptions.append(DatasetNotFoundError())
        else:
            self._base_model = base_model

        if self._base_model and self._base_model.kind != "virtual":
            exceptions.append(DatasourceTypeInvalidError())

        if DatasetDAO.find_one_or_none(table_name=duplicate_name):
            exceptions.append(DatasetExistsValidationError(table=Table(duplicate_name)))

        try:
            owners = self.populate_owners()
            self._properties["owners"] = owners
        except ValidationError as ex:
            exceptions.append(ex)

        if exceptions:
            raise DatasetInvalidError(exceptions=exceptions)
