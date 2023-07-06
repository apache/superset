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
from typing import Any

from sqlalchemy.exc import SQLAlchemyError

from superset import security_manager
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils.core import DatasourceType, get_iterable
from superset.views.base import DatasourceFilter

logger = logging.getLogger(__name__)


class DatasetDAO(BaseDAO[SqlaTable]):  # pylint: disable=too-many-public-methods
    base_filter = DatasourceFilter

    @staticmethod
    def get_database_by_id(database_id: int) -> Database | None:
        try:
            return db.session.query(Database).filter_by(id=database_id).one_or_none()
        except SQLAlchemyError as ex:  # pragma: no cover
            logger.error("Could not get database by id: %s", str(ex), exc_info=True)
            return None

    @staticmethod
    def get_related_objects(database_id: int) -> dict[str, Any]:
        charts = (
            db.session.query(Slice)
            .filter(
                Slice.datasource_id == database_id,
                Slice.datasource_type == DatasourceType.TABLE,
            )
            .all()
        )
        chart_ids = [chart.id for chart in charts]

        dashboards = (
            (
                db.session.query(Dashboard)
                .join(Dashboard.slices)
                .filter(Slice.id.in_(chart_ids))
            )
            .distinct()
            .all()
        )
        return dict(charts=charts, dashboards=dashboards)

    @staticmethod
    def validate_table_exists(
        database: Database, table_name: str, schema: str | None
    ) -> bool:
        try:
            database.get_table(table_name, schema=schema)
            return True
        except SQLAlchemyError as ex:  # pragma: no cover
            logger.warning("Got an error %s validating table: %s", str(ex), table_name)
            return False

    @staticmethod
    def validate_uniqueness(
        database_id: int,
        schema: str | None,
        name: str,
        dataset_id: int | None = None,
    ) -> bool:
        dataset_query = db.session.query(SqlaTable).filter(
            SqlaTable.table_name == name,
            SqlaTable.schema == schema,
            SqlaTable.database_id == database_id,
        )

        if dataset_id:
            # make sure the dataset found is different from the target (if any)
            dataset_query = dataset_query.filter(SqlaTable.id != dataset_id)

        return not db.session.query(dataset_query.exists()).scalar()

    @staticmethod
    def validate_update_uniqueness(
        database_id: int, dataset_id: int, name: str
    ) -> bool:
        dataset_query = db.session.query(SqlaTable).filter(
            SqlaTable.table_name == name,
            SqlaTable.database_id == database_id,
            SqlaTable.id != dataset_id,
        )
        return not db.session.query(dataset_query.exists()).scalar()

    @staticmethod
    def validate_columns_exist(dataset_id: int, columns_ids: list[int]) -> bool:
        dataset_query = (
            db.session.query(TableColumn.id).filter(
                TableColumn.table_id == dataset_id, TableColumn.id.in_(columns_ids)
            )
        ).all()
        return len(columns_ids) == len(dataset_query)

    @staticmethod
    def validate_columns_uniqueness(dataset_id: int, columns_names: list[str]) -> bool:
        dataset_query = (
            db.session.query(TableColumn.id).filter(
                TableColumn.table_id == dataset_id,
                TableColumn.column_name.in_(columns_names),
            )
        ).all()
        return len(dataset_query) == 0

    @staticmethod
    def validate_metrics_exist(dataset_id: int, metrics_ids: list[int]) -> bool:
        dataset_query = (
            db.session.query(SqlMetric.id).filter(
                SqlMetric.table_id == dataset_id, SqlMetric.id.in_(metrics_ids)
            )
        ).all()
        return len(metrics_ids) == len(dataset_query)

    @staticmethod
    def validate_metrics_uniqueness(dataset_id: int, metrics_names: list[str]) -> bool:
        dataset_query = (
            db.session.query(SqlMetric.id).filter(
                SqlMetric.table_id == dataset_id,
                SqlMetric.metric_name.in_(metrics_names),
            )
        ).all()
        return len(dataset_query) == 0

    @classmethod
    def update(
        cls,
        model: SqlaTable,
        properties: dict[str, Any],
        commit: bool = True,
    ) -> SqlaTable:
        """
        Updates a Dataset model on the metadata DB
        """

        if "columns" in properties:
            cls.update_columns(
                model,
                properties.pop("columns"),
                commit=commit,
                override_columns=bool(properties.get("override_columns")),
            )

        if "metrics" in properties:
            cls.update_metrics(model, properties.pop("metrics"), commit=commit)

        return super().update(model, properties, commit=commit)

    @classmethod
    def update_columns(
        cls,
        model: SqlaTable,
        property_columns: list[dict[str, Any]],
        commit: bool = True,
        override_columns: bool = False,
    ) -> None:
        """
        Creates/updates and/or deletes a list of columns, based on a
        list of Dict.

        - If a column Dict has an `id` property then we update.
        - If a column Dict does not have an `id` then we create a new metric.
        - If there are extra columns on the metadata db that are not defined on the List
        then we delete.
        """

        if override_columns:
            db.session.query(TableColumn).filter(
                TableColumn.table_id == model.id
            ).delete(synchronize_session="fetch")

            db.session.bulk_insert_mappings(
                TableColumn,
                [
                    {**properties, "table_id": model.id}
                    for properties in property_columns
                ],
            )
        else:
            columns_by_id = {column.id: column for column in model.columns}

            property_columns_by_id = {
                properties["id"]: properties
                for properties in property_columns
                if "id" in properties
            }

            db.session.bulk_insert_mappings(
                TableColumn,
                [
                    {**properties, "table_id": model.id}
                    for properties in property_columns
                    if not "id" in properties
                ],
            )

            db.session.bulk_update_mappings(
                TableColumn,
                [
                    {**columns_by_id[properties["id"]].__dict__, **properties}
                    for properties in property_columns_by_id.values()
                ],
            )

            db.session.query(TableColumn).filter(
                TableColumn.id.in_(
                    {column.id for column in model.columns}
                    - property_columns_by_id.keys()
                )
            ).delete(synchronize_session="fetch")

        if commit:
            db.session.commit()

    @classmethod
    def update_metrics(
        cls,
        model: SqlaTable,
        property_metrics: list[dict[str, Any]],
        commit: bool = True,
    ) -> None:
        """
        Creates/updates and/or deletes a list of metrics, based on a
        list of Dict.

        - If a metric Dict has an `id` property then we update.
        - If a metric Dict does not have an `id` then we create a new metric.
        - If there are extra metrics on the metadata db that are not defined on the List
        then we delete.
        """

        metrics_by_id = {metric.id: metric for metric in model.metrics}

        property_metrics_by_id = {
            properties["id"]: properties
            for properties in property_metrics
            if "id" in properties
        }

        db.session.bulk_insert_mappings(
            SqlMetric,
            [
                {**properties, "table_id": model.id}
                for properties in property_metrics
                if not "id" in properties
            ],
        )

        db.session.bulk_update_mappings(
            SqlMetric,
            [
                {**metrics_by_id[properties["id"]].__dict__, **properties}
                for properties in property_metrics_by_id.values()
            ],
        )

        db.session.query(SqlMetric).filter(
            SqlMetric.id.in_(
                {metric.id for metric in model.metrics} - property_metrics_by_id.keys()
            )
        ).delete(synchronize_session="fetch")

        if commit:
            db.session.commit()

    @classmethod
    def find_dataset_column(cls, dataset_id: int, column_id: int) -> TableColumn | None:
        # We want to apply base dataset filters
        dataset = DatasetDAO.find_by_id(dataset_id)
        if not dataset:
            return None
        return (
            db.session.query(TableColumn)
            .filter(TableColumn.table_id == dataset_id, TableColumn.id == column_id)
            .one_or_none()
        )

    @classmethod
    def update_column(
        cls,
        model: TableColumn,
        properties: dict[str, Any],
        commit: bool = True,
    ) -> TableColumn:
        return DatasetColumnDAO.update(model, properties, commit=commit)

    @classmethod
    def create_column(
        cls, properties: dict[str, Any], commit: bool = True
    ) -> TableColumn:
        """
        Creates a Dataset model on the metadata DB
        """
        return DatasetColumnDAO.create(properties, commit=commit)

    @classmethod
    def delete_column(cls, model: TableColumn, commit: bool = True) -> None:
        """
        Deletes a Dataset column
        """
        DatasetColumnDAO.delete(model, commit=commit)

    @classmethod
    def find_dataset_metric(cls, dataset_id: int, metric_id: int) -> SqlMetric | None:
        # We want to apply base dataset filters
        dataset = DatasetDAO.find_by_id(dataset_id)
        if not dataset:
            return None
        return db.session.query(SqlMetric).get(metric_id)

    @classmethod
    def delete_metric(cls, model: SqlMetric, commit: bool = True) -> None:
        """
        Deletes a Dataset metric
        """
        DatasetMetricDAO.delete(model, commit=commit)

    @classmethod
    def update_metric(
        cls,
        model: SqlMetric,
        properties: dict[str, Any],
        commit: bool = True,
    ) -> SqlMetric:
        return DatasetMetricDAO.update(model, properties, commit=commit)

    @classmethod
    def create_metric(
        cls,
        properties: dict[str, Any],
        commit: bool = True,
    ) -> SqlMetric:
        """
        Creates a Dataset model on the metadata DB
        """
        return DatasetMetricDAO.create(properties, commit=commit)

    @classmethod
    def delete(
        cls,
        items: SqlaTable | list[SqlaTable],
        commit: bool = True,
    ) -> None:
        """
        Delete the specified items(s) including their associated relationships.

        Note that bulk deletion via `delete` does not dispatch the `after_delete` event
        and thus the ORM event listener callback needs to be invoked manually.

        :param items: The item(s) to delete
        :param commit: Whether to commit the transaction
        :raises DAODeleteFailedError: If the deletion failed
        :see: https://docs.sqlalchemy.org/en/latest/orm/queryguide/dml.html
        """

        try:
            db.session.query(SqlaTable).filter(
                SqlaTable.id.in_(item.id for item in get_iterable(items))
            ).delete(synchronize_session="fetch")

            connection = db.session.connection()
            mapper = next(iter(cls.model_cls.registry.mappers))  # type: ignore

            for item in get_iterable(items):
                security_manager.dataset_after_delete(mapper, connection, item)

            if commit:
                db.session.commit()
        except SQLAlchemyError as ex:
            if commit:
                db.session.rollback()
            raise ex

    @staticmethod
    def get_table_by_name(database_id: int, table_name: str) -> SqlaTable | None:
        return (
            db.session.query(SqlaTable)
            .filter_by(database_id=database_id, table_name=table_name)
            .one_or_none()
        )


class DatasetColumnDAO(BaseDAO[TableColumn]):
    pass


class DatasetMetricDAO(BaseDAO[SqlMetric]):
    pass
