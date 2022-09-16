import logging
from contextlib import closing
from typing import Any, Dict, List, Optional

from flask_babel import lazy_gettext as _
from flask_appbuilder.models.sqla import Model
from flask_appbuilder.security.sqla.models import User


from marshmallow import ValidationError
from superset.commands.base import BaseCommand, CreateMixin
from superset.connectors.sqla.models import (
    MetadataResult,
    SqlMetric,
    SqlaTable,
    TableColumn,
)

from superset.datasets.commands.exceptions import (
    DatasetInvalidError,
    DatasetExistsValidationError,
    DatabaseNotFoundValidationError,
)

from superset import app
from superset.sql_parse import ParsedQuery
from superset.datasets.dao import DatasetDAO
from superset.extensions import db, security_manager
from superset.exceptions import SupersetGenericDBErrorException

config = app.config
logger = logging.getLogger(__name__)


class CreateMultiDatasetCommand(CreateMixin, BaseCommand):
    def __init__(self, user: User, data: Dict[str, Any]):
        self._actor = user
        self._properties = data.copy()

    def validate(self) -> None:
        exceptions: List[ValidationError] = []
        table_name = self._properties["table_name"]
        database_id = self._properties["database_id"]
        schema = self._properties.get("schema", None)
        owner_ids: Optional[List[int]] = self._properties.get("owners")

        if not DatasetDAO.validate_uniqueness(database_id, schema, table_name):
            exceptions.append(DatasetExistsValidationError(table_name))

        database = DatasetDAO.get_database_by_id(database_id)

        if not database:
            exceptions.append(DatabaseNotFoundValidationError())

        self._properties["database"] = database

        try:
            owners = self.populate_owners(owner_ids)
            self._properties["owners"] = owners
        except ValidationError as ex:
            exceptions.append(ex)
        if exceptions:
            exception = DatasetInvalidError()
            exception.add_list(exceptions)
            raise exception

    def external_metadata(self, dataset: SqlaTable) -> List[Dict[str, Any]]:
        """Returns column information from the external system"""
        if not dataset.sql:
            raise SupersetGenericDBErrorException(
                message=_("Virtual dataset query cannot be empty"),
            )

        db_engine_spec = dataset.database.db_engine_spec
        engine = dataset.database.get_sqla_engine(schema=dataset.schema)

        sql = dataset.get_template_processor().process_template(
            dataset.sql, **dataset.template_params_dict
        )
        parsed_query = ParsedQuery(sql)
        statements = parsed_query.get_statements()

        try:
            with closing(engine.raw_connection()) as conn:
                cursor = conn.cursor()
                query = dataset.database.apply_limit_to_sql(statements[0])
                db_engine_spec.execute(cursor, query)
                db_engine_spec.fetch_data(cursor, limit=1)
        except Exception as ex:
            raise SupersetGenericDBErrorException(message=ex.args[0]["message"]) from ex

        results = engine.execute(statements[0])
        result_description = results.cursor.description
        return [{"name": column[0], "type": column[1]} for column in result_description]

    def fetch_metadata(self, dataset: SqlaTable, commit: bool = True):
        """
        Fetches the metadata for the table and merges it in
        """
        new_columns = self.external_metadata(dataset)

        metrics = []
        any_date_col = None
        db_engine_spec = dataset.db_engine_spec

        old_columns = (
            (
                db.session.query(TableColumn)
                .filter(TableColumn.table_id == dataset.id)
                .all()
            )
            if dataset.id
            else dataset.columns
        )

        old_columns_by_name: Dict[str, TableColumn] = {
            col.column_name: col for col in old_columns
        }

        results = MetadataResult(
            removed=[
                col
                for col in old_columns_by_name
                if col not in {col["name"] for col in new_columns}
            ]
        )

        columns = []

        for col in new_columns:
            old_column = old_columns_by_name.pop(col["name"], None)
            if not old_column:
                results.added.append(col["name"])
                new_column = TableColumn(
                    column_name=col["name"], type=col["type"], table=dataset
                )
                new_column.is_dttm = new_column.is_temporal
                db_engine_spec.alter_new_orm_column(new_column)
            else:
                new_column = old_column
                if new_column.type != col["type"]:
                    results.modified.append(col["name"])
                new_column.type = col["type"]
                new_column.expression = ""
            new_column.groupby = True
            new_column.filterable = True
            columns.append(new_column)
            if not any_date_col and new_column.is_temporal:
                any_date_col = col["name"]

        # add back calculated (virtual) columns
        columns.extend([col for col in old_columns if col.expression])
        dataset.columns = columns

        metrics.append(
            SqlMetric(
                metric_name="count",
                verbose_name="COUNT(*)",
                metric_type="count",
                expression="COUNT(*)",
            )
        )

        if not dataset.main_dttm_col:
            dataset.main_dttm_col = any_date_col
        dataset.add_missing_metrics(metrics)

        config["SQLA_TABLE_MUTATOR"](dataset)

        db.session.merge(dataset)

        if commit:
            db.session.commit()

    def run(self) -> Model:
        self.validate()
        try:
            dataset = DatasetDAO.create(self._properties, commit=False)
            self.fetch_metadata(dataset, commit=False)
            security_manager.add_permission_view_menu(
                "datasource_access", dataset.get_perm()
            )
            db.session.commit()
        except Exception as ex:
            logger.warning(ex, exc_info=True)
            db.session.rollback()
            raise SupersetGenericDBErrorException(message=ex.message) from ex
        return dataset
