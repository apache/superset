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

from superset import security_manager
from superset.commands.base import BaseCommand, CreateMixin
from superset.commands.dataset.exceptions import (
    DatasetAccessDeniedError,
    DatasetDuplicateFailedError,
    DatasetExistsValidationError,
    DatasetInvalidError,
    DatasetNotFoundError,
    DatasetSqlRenderValidationError,
    TEMPLATE_RENDER_ERRORS,
    TemplateParamsInvalidValidationError,
)
from superset.commands.exceptions import DatasourceTypeInvalidError
from superset.connectors.sqla.models import SqlaTable, SqlFilter, SqlMetric, TableColumn
from superset.daos.dataset import DatasetDAO
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetErrorException,
    SupersetParseError,
    SupersetSecurityException,
)
from superset.extensions import db
from superset.models.core import Database
from superset.models.helpers import (
    parse_template_params,
    template_params_for_access_check,
)
from superset.sql.parse import Table
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class DuplicateDatasetCommand(CreateMixin, BaseCommand):
    def __init__(self, data: dict[str, Any]) -> None:
        self._base_model: SqlaTable = SqlaTable()
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=DatasetDuplicateFailedError))
    def run(self) -> Model:
        self.validate()
        # Declare the high-level avenue before the duplicate touches
        # the session. The change-record listener stamps
        # ``version_transaction.action_kind = 'clone'`` so the new
        # dataset's baseline records read as a clone in the timeline.
        # Method-scoped import — defers the versioning bootstrap path
        # out of this command's module-load graph; see ``changes.py``
        # module docstring for the broader init-order rationale.
        from superset.versioning.changes import ACTION_KIND_CLONE, ACTION_KIND_KEY

        db.session.info[ACTION_KIND_KEY] = ACTION_KIND_CLONE
        database_id = self._base_model.database_id
        table_name = self._properties["table_name"]
        editors = self._properties["editors"]
        database = db.session.get(Database, database_id)
        if not database:
            raise SupersetErrorException(
                SupersetError(
                    message=__("The database was not found."),
                    error_type=SupersetErrorType.DATABASE_NOT_FOUND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=404,
            )
        table = SqlaTable()
        table.override(self._base_model)
        table.table_name = table_name
        table.editors = editors
        table.database = database
        table.is_sqllab_view = True
        if table.sql:
            table.sql = table.sql.strip().strip(";")
        db.session.add(table)

        columns = [
            TableColumn(
                column_name=c.column_name,
                verbose_name=c.verbose_name,
                expression=c.expression,
                filterable=c.filterable,
                groupby=c.groupby,
                is_dttm=c.is_dttm,
                type=c.type,
                description=c.description,
            )
            for c in self._base_model.columns
        ]
        db.session.add_all(columns)
        table.columns = columns

        metrics = [
            SqlMetric(
                metric_name=m.metric_name,
                verbose_name=m.verbose_name,
                expression=m.expression,
                metric_type=m.metric_type,
                description=m.description,
                d3format=m.d3format,
                currency=m.currency,
                warning_text=m.warning_text,
                extra=m.extra,
            )
            for m in self._base_model.metrics
        ]
        db.session.add_all(metrics)
        table.metrics = metrics

        filters = [
            SqlFilter(
                filter_name=f.filter_name,
                verbose_name=f.verbose_name,
                expression=f.expression,
                description=f.description,
                warning_text=f.warning_text,
                extra=f.extra,
            )
            for f in self._base_model.filters
        ]
        db.session.add_all(filters)
        table.filters = filters

        return table

    def validate(self) -> None:
        exceptions: list[ValidationError] = []
        base_model_id = self._properties["base_model_id"]
        duplicate_name = self._properties["table_name"]

        base_model = DatasetDAO.find_by_id(base_model_id)
        if not base_model:
            exceptions.append(DatasetNotFoundError())
        else:
            try:
                security_manager.raise_for_access(datasource=base_model)
            except SupersetSecurityException as ex:
                raise DatasetAccessDeniedError() from ex
            self._base_model = base_model
            # The copy is a new dataset the caller owns that reads the base's
            # SQL, so authorize it as the create path would: real data access
            # to the tables that SQL reads, not editorship of the base (which
            # the check above accepts). Otherwise the copy would outlive the
            # caller's access to the base.
            if base_model.sql:
                self._validate_copy_sql_access(base_model, exceptions)

        if self._base_model and self._base_model.kind != "virtual":
            exceptions.append(DatasourceTypeInvalidError())

        # Use the shared uniqueness check (same as create/update) rather than a
        # name-only filtered lookup: it scopes to the base model's
        # database/schema, is catalog-NULL-aware, and bypasses the soft-delete
        # visibility filter. A filtered lookup misses a soft-deleted twin, so
        # the duplicate would proceed and either hit a DB constraint as an
        # opaque IntegrityError or — where no constraint applies (the
        # model-level UniqueConstraint is metadata-only and the legacy
        # _customer_location_uc is NULL-leaky) — create an active twin that
        # permanently blocks restore of the soft-deleted dataset.
        if base_model and not DatasetDAO.validate_uniqueness(
            base_model.database,
            Table(duplicate_name, base_model.schema, base_model.catalog),
        ):
            exceptions.append(DatasetExistsValidationError(table=Table(duplicate_name)))

        try:
            from superset.commands.utils import populate_subject_list

            editors = populate_subject_list(
                self._properties.get("editors"),
                default_to_user=True,
                field_name="editors",
            )
            self._properties["editors"] = editors
        except ValidationError as ex:
            exceptions.append(ex)

        if exceptions:
            raise DatasetInvalidError(exceptions=exceptions)

    @staticmethod
    def _validate_copy_sql_access(
        base_model: SqlaTable, exceptions: list[ValidationError]
    ) -> None:
        """Authorize the SQL the copy will run, as stored by ``run``."""
        try:
            template_params = parse_template_params(base_model.template_params)
        except ValueError:
            exceptions.append(TemplateParamsInvalidValidationError())
            return
        try:
            security_manager.raise_for_access(
                database=base_model.database,
                sql=base_model.sql.strip().strip(";"),
                catalog=base_model.catalog,
                schema=base_model.schema,
                template_params=template_params_for_access_check(template_params),
                allow_editorship=False,
            )
        except SupersetSecurityException as ex:
            raise DatasetAccessDeniedError() from ex
        except SupersetParseError as ex:
            exceptions.append(
                ValidationError(f"Invalid SQL: {ex.error.message}", field_name="sql")
            )
        except TEMPLATE_RENDER_ERRORS as ex:
            exceptions.append(DatasetSqlRenderValidationError(ex))
