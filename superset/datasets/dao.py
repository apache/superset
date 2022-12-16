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

from sqlalchemy.exc import SQLAlchemyError

from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.dao.base import BaseDAO
from superset.extensions import db
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils.core import DatasourceType
from superset.views.base import DatasourceFilter

logger = logging.getLogger(__name__)


class DatasetDAO(BaseDAO):  # pylint: disable=too-many-public-methods
    model_cls = SqlaTable
    base_filter = DatasourceFilter

    @staticmethod
    def get_database_by_id(database_id: int) -> Optional[Database]:
        try:
            return db.session.query(Database).filter_by(id=database_id).one_or_none()
        except SQLAlchemyError as ex:  # pragma: no cover
            logger.error("Could not get database by id: %s", str(ex), exc_info=True)
            return None

    @staticmethod
    def get_related_objects(database_id: int) -> Dict[str, Any]:
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
        database: Database, table_name: str, schema: Optional[str]
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
        schema: Optional[str],
        name: str,
        dataset_id: Optional[int] = None,
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
    def validate_columns_exist(dataset_id: int, columns_ids: List[int]) -> bool:
        dataset_query = (
            db.session.query(TableColumn.id).filter(
                TableColumn.table_id == dataset_id, TableColumn.id.in_(columns_ids)
            )
        ).all()
        return len(columns_ids) == len(dataset_query)

    @staticmethod
    def validate_columns_uniqueness(dataset_id: int, columns_names: List[str]) -> bool:
        dataset_query = (
            db.session.query(TableColumn.id).filter(
                TableColumn.table_id == dataset_id,
                TableColumn.column_name.in_(columns_names),
            )
        ).all()
        return len(dataset_query) == 0

    @staticmethod
    def validate_metrics_exist(dataset_id: int, metrics_ids: List[int]) -> bool:
        dataset_query = (
            db.session.query(SqlMetric.id).filter(
                SqlMetric.table_id == dataset_id, SqlMetric.id.in_(metrics_ids)
            )
        ).all()
        return len(metrics_ids) == len(dataset_query)

    @staticmethod
    def validate_metrics_uniqueness(dataset_id: int, metrics_names: List[str]) -> bool:
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
        properties: Dict[str, Any],
        commit: bool = True,
    ) -> Optional[SqlaTable]:
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
        property_columns: List[Dict[str, Any]],
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

        column_by_id = {column.id: column for column in model.columns}
        seen = set()
        original_cols = {obj.id for obj in model.columns}

        if override_columns:
            for id_ in original_cols:
                DatasetDAO.delete_column(column_by_id[id_], commit=False)

            db.session.flush()

            for properties in property_columns:
                DatasetDAO.create_column(
                    {**properties, "table_id": model.id},
                    commit=False,
                )
        else:
            for properties in property_columns:
                if "id" in properties:
                    seen.add(properties["id"])

                    DatasetDAO.update_column(
                        column_by_id[properties["id"]],
                        properties,
                        commit=False,
                    )
                else:
                    DatasetDAO.create_column(
                        {**properties, "table_id": model.id},
                        commit=False,
                    )

            for id_ in {obj.id for obj in model.columns} - seen:
                DatasetDAO.delete_column(column_by_id[id_], commit=False)

        if commit:
            db.session.commit()

    @classmethod
    def update_metrics(
        cls,
        model: SqlaTable,
        property_metrics: List[Dict[str, Any]],
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

        metric_by_id = {metric.id: metric for metric in model.metrics}
        seen = set()

        for properties in property_metrics:
            if "id" in properties:
                seen.add(properties["id"])

                DatasetDAO.update_metric(
                    metric_by_id[properties["id"]],
                    properties,
                    commit=False,
                )
            else:
                DatasetDAO.create_metric(
                    {**properties, "table_id": model.id},
                    commit=False,
                )

        for id_ in {obj.id for obj in model.metrics} - seen:
            DatasetDAO.delete_column(metric_by_id[id_], commit=False)

        if commit:
            db.session.commit()

    @classmethod
    def find_dataset_column(
        cls, dataset_id: int, column_id: int
    ) -> Optional[TableColumn]:
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
        properties: Dict[str, Any],
        commit: bool = True,
    ) -> TableColumn:
        return DatasetColumnDAO.update(model, properties, commit=commit)

    @classmethod
    def create_column(
        cls, properties: Dict[str, Any], commit: bool = True
    ) -> TableColumn:
        """
        Creates a Dataset model on the metadata DB
        """
        return DatasetColumnDAO.create(properties, commit=commit)

    @classmethod
    def delete_column(cls, model: TableColumn, commit: bool = True) -> TableColumn:
        """
        Deletes a Dataset column
        """
        return cls.delete(model, commit=commit)

    @classmethod
    def find_dataset_metric(
        cls, dataset_id: int, metric_id: int
    ) -> Optional[SqlMetric]:
        # We want to apply base dataset filters
        dataset = DatasetDAO.find_by_id(dataset_id)
        if not dataset:
            return None
        return db.session.query(SqlMetric).get(metric_id)

    @classmethod
    def delete_metric(cls, model: SqlMetric, commit: bool = True) -> SqlMetric:
        """
        Deletes a Dataset metric
        """
        return cls.delete(model, commit=commit)

    @classmethod
    def update_metric(
        cls,
        model: SqlMetric,
        properties: Dict[str, Any],
        commit: bool = True,
    ) -> SqlMetric:
        return DatasetMetricDAO.update(model, properties, commit=commit)

    @classmethod
    def create_metric(
        cls,
        properties: Dict[str, Any],
        commit: bool = True,
    ) -> SqlMetric:
        """
        Creates a Dataset model on the metadata DB
        """
        return DatasetMetricDAO.create(properties, commit=commit)

    @staticmethod
    def bulk_delete(models: Optional[List[SqlaTable]], commit: bool = True) -> None:
        item_ids = [model.id for model in models] if models else []
        # bulk delete, first delete related data
        if models:
            for model in models:
                model.owners = []
                db.session.merge(model)
            db.session.query(SqlMetric).filter(SqlMetric.table_id.in_(item_ids)).delete(
                synchronize_session="fetch"
            )
            db.session.query(TableColumn).filter(
                TableColumn.table_id.in_(item_ids)
            ).delete(synchronize_session="fetch")
        # bulk delete itself
        try:
            db.session.query(SqlaTable).filter(SqlaTable.id.in_(item_ids)).delete(
                synchronize_session="fetch"
            )
            if commit:
                db.session.commit()
        except SQLAlchemyError as ex:
            if commit:
                db.session.rollback()
            raise ex


class DatasetColumnDAO(BaseDAO):
    model_cls = TableColumn


class DatasetMetricDAO(BaseDAO):
    model_cls = SqlMetric
