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
from __future__ import annotations

import logging
from collections import Counter
from functools import partial
from typing import Any, cast, Optional

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from superset import is_feature_enabled, security_manager
from superset.commands.base import BaseCommand, UpdateMixin
from superset.commands.dataset.exceptions import (
    DatabaseNotFoundValidationError,
    DatasetColumnNotFoundValidationError,
    DatasetColumnsDuplicateValidationError,
    DatasetColumnsExistsValidationError,
    DatasetDataAccessIsNotAllowed,
    DatasetExistsValidationError,
    DatasetForbiddenError,
    DatasetInvalidError,
    DatasetMetricsDuplicateValidationError,
    DatasetMetricsExistsValidationError,
    DatasetMetricsNotFoundValidationError,
    DatasetNotFoundError,
    DatasetUpdateFailedError,
    MultiCatalogDisabledValidationError,
)
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.daos.dataset import DatasetDAO
from superset.datasets.schemas import FolderSchema
from superset.exceptions import SupersetParseError, SupersetSecurityException
from superset.models.core import Database
from superset.sql.parse import Table
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateDatasetCommand(UpdateMixin, BaseCommand):
    def __init__(
        self,
        model_id: int,
        data: dict[str, Any],
        override_columns: Optional[bool] = False,
    ):
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[SqlaTable] = None
        self.override_columns = override_columns
        self._properties["override_columns"] = override_columns

    @transaction(
        on_error=partial(
            on_error,
            catches=(
                SQLAlchemyError,
                ValueError,
            ),
            reraise=DatasetUpdateFailedError,
        )
    )
    def run(self) -> Model:
        self.validate()
        assert self._model
        return DatasetDAO.update(self._model, attributes=self._properties)

    def validate(self) -> None:
        exceptions: list[ValidationError] = []
        owner_ids: Optional[list[int]] = self._properties.get("owners")

        # Validate/populate model exists
        self._model = DatasetDAO.find_by_id(self._model_id)
        if not self._model:
            raise DatasetNotFoundError()

        # Check permission to update the dataset
        try:
            security_manager.raise_for_ownership(self._model)
        except SupersetSecurityException as ex:
            raise DatasetForbiddenError() from ex

        # Validate/Populate owner
        try:
            owners = self.compute_owners(
                self._model.owners,
                owner_ids,
            )
            self._properties["owners"] = owners
        except ValidationError as ex:
            exceptions.append(ex)

        self._validate_dataset_source(exceptions)
        self._validate_semantics(exceptions)

        if exceptions:
            raise DatasetInvalidError(exceptions=exceptions)

    def _validate_dataset_source(self, exceptions: list[ValidationError]) -> None:
        # we know we have a valid model
        self._model = cast(SqlaTable, self._model)
        database_id = self._properties.pop("database_id", None)
        catalog = self._properties.get("catalog")
        new_db_connection: Database | None = None

        if database_id and database_id != self._model.database.id:
            if new_db_connection := DatasetDAO.get_database_by_id(database_id):
                self._properties["database"] = new_db_connection
            else:
                exceptions.append(DatabaseNotFoundValidationError())
        db = new_db_connection or self._model.database
        default_catalog = db.get_default_catalog()

        # If multi-catalog is disabled, and catalog provided is not
        # the default one, fail
        if (
            "catalog" in self._properties
            and catalog != default_catalog
            and not db.allow_multi_catalog
        ):
            exceptions.append(MultiCatalogDisabledValidationError())

        # If the DB connection does not support multi-catalog,
        # use the default catalog
        elif not db.allow_multi_catalog:
            catalog = self._properties["catalog"] = default_catalog

        # Fallback to using the previous value if not provided
        elif "catalog" not in self._properties:
            catalog = self._model.catalog

        schema = (
            self._properties["schema"]
            if "schema" in self._properties
            else self._model.schema
        )

        table = Table(
            self._properties.get("table_name", self._model.table_name),
            schema,
            catalog,
        )

        # Validate uniqueness
        if not DatasetDAO.validate_update_uniqueness(
            db,
            table,
            self._model_id,
        ):
            exceptions.append(DatasetExistsValidationError(table))

        self._validate_sql_access(db, catalog, schema, exceptions)

    def _validate_sql_access(
        self,
        db: Database,
        catalog: str | None,
        schema: str | None,
        exceptions: list[ValidationError],
    ) -> None:
        """Validate SQL query access if SQL is being updated."""
        # we know we have a valid model
        self._model = cast(SqlaTable, self._model)

        sql = self._properties.get("sql")
        if sql and sql != self._model.sql:
            try:
                security_manager.raise_for_access(
                    database=db,
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

    def _validate_semantics(self, exceptions: list[ValidationError]) -> None:
        # we know we have a valid model
        self._model = cast(SqlaTable, self._model)
        if columns := self._properties.get("columns"):
            self._validate_columns(columns, exceptions)

        if metrics := self._properties.get("metrics"):
            self._validate_metrics(metrics, exceptions)

        if folders := self._properties.get("folders"):
            try:
                validate_folders(folders, self._model.metrics, self._model.columns)
            except ValidationError as ex:
                exceptions.append(ex)

            # dump schema to convert UUID to string
            schema = FolderSchema(many=True)
            self._properties["folders"] = schema.dump(folders)

    def _validate_columns(
        self, columns: list[dict[str, Any]], exceptions: list[ValidationError]
    ) -> None:
        # Validate duplicates on data
        if self._get_duplicates(columns, "column_name"):
            exceptions.append(DatasetColumnsDuplicateValidationError())
        else:
            # validate invalid id's
            columns_ids: list[int] = [
                column["id"] for column in columns if "id" in column
            ]
            if not DatasetDAO.validate_columns_exist(self._model_id, columns_ids):
                exceptions.append(DatasetColumnNotFoundValidationError())

            # validate new column names uniqueness
            if not self.override_columns:
                columns_names: list[str] = [
                    column["column_name"] for column in columns if "id" not in column
                ]
                if not DatasetDAO.validate_columns_uniqueness(
                    self._model_id, columns_names
                ):
                    exceptions.append(DatasetColumnsExistsValidationError())

    def _validate_metrics(
        self, metrics: list[dict[str, Any]], exceptions: list[ValidationError]
    ) -> None:
        if self._get_duplicates(metrics, "metric_name"):
            exceptions.append(DatasetMetricsDuplicateValidationError())
        else:
            # validate invalid id's
            metrics_ids: list[int] = [
                metric["id"] for metric in metrics if "id" in metric
            ]
            if not DatasetDAO.validate_metrics_exist(self._model_id, metrics_ids):
                exceptions.append(DatasetMetricsNotFoundValidationError())
            # validate new metric names uniqueness
            metric_names: list[str] = [
                metric["metric_name"] for metric in metrics if "id" not in metric
            ]
            if not DatasetDAO.validate_metrics_uniqueness(self._model_id, metric_names):
                exceptions.append(DatasetMetricsExistsValidationError())

    @staticmethod
    def _get_duplicates(data: list[dict[str, Any]], key: str) -> list[str]:
        duplicates = [
            name
            for name, count in Counter([item[key] for item in data]).items()
            if count > 1
        ]
        return duplicates


def validate_folders(  # noqa: C901
    folders: list[FolderSchema],
    metrics: list[SqlMetric],
    columns: list[TableColumn],
) -> None:
    """
    Additional folder validation.

    The marshmallow schema will validate the folder structure, but we still need to
    check that UUIDs are valid, names are unique and not reserved, and that there are
    no cycles.
    """
    if not is_feature_enabled("DATASET_FOLDERS"):
        raise ValidationError("Dataset folders are not enabled")

    existing = {
        *[metric.uuid for metric in metrics],
        *[column.uuid for column in columns],
    }

    queue: list[tuple[FolderSchema, list[str]]] = [(folder, []) for folder in folders]
    seen_uuids = set()
    seen_fqns = set()  # fully qualified folder names
    while queue:
        obj, path = queue.pop(0)
        uuid, name = obj["uuid"], obj.get("name")

        if uuid in path:
            raise ValidationError(f"Cycle detected: {uuid} appears in its ancestry")

        if uuid in seen_uuids:
            raise ValidationError(f"Duplicate UUID in folder structure: {uuid}")
        seen_uuids.add(uuid)

        # folders can have duplicate name as long as they're not siblings
        if name:
            fqn = tuple(path + [name])
            if name and fqn in seen_fqns:
                raise ValidationError(f"Duplicate folder name: {name}")
            seen_fqns.add(fqn)

            if name.lower() in {"metrics", "columns"}:
                raise ValidationError(f"Folder cannot have name '{name}'")

        # check if metric/column UUID exists
        elif not name and uuid not in existing:
            raise ValidationError(f"Invalid UUID: {uuid}")

        # traverse children
        if children := obj.get("children"):
            path.append(uuid)
            queue.extend((folder, path) for folder in children)
