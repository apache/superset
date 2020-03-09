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
from typing import Dict, List, Optional

from flask import current_app
from flask_appbuilder.models.sqla.interface import SQLAInterface
from sqlalchemy.exc import SQLAlchemyError

from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.dao.base import generic_create, generic_delete, generic_update
from superset.extensions import db
from superset.models.core import Database
from superset.views.base import DatasourceFilter

logger = logging.getLogger(__name__)


class DatasetDAO:
    @staticmethod
    def get_owner_by_id(owner_id: int) -> Optional[object]:
        return (
            db.session.query(current_app.appbuilder.sm.user_model)
            .filter_by(id=owner_id)
            .one_or_none()
        )

    @staticmethod
    def get_database_by_id(database_id) -> Optional[Database]:
        try:
            return db.session.query(Database).filter_by(id=database_id).one_or_none()
        except SQLAlchemyError as e:  # pragma: no cover
            logger.error(f"Could not get database by id: {e}")
            return None

    @staticmethod
    def validate_table_exists(database: Database, table_name: str, schema: str) -> bool:
        try:
            database.get_table(table_name, schema=schema)
            return True
        except SQLAlchemyError as e:  # pragma: no cover
            logger.error(f"Got an error {e} validating table: {table_name}")
            return False

    @staticmethod
    def validate_uniqueness(database_id: int, name: str) -> bool:
        dataset_query = db.session.query(SqlaTable).filter(
            SqlaTable.table_name == name, SqlaTable.database_id == database_id
        )
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
    def validate_metrics_exist(dataset_id: int, metrics_ids: List[int]) -> bool:
        dataset_query = (
            db.session.query(SqlMetric.id).filter(
                SqlMetric.table_id == dataset_id, SqlMetric.id.in_(metrics_ids)
            )
        ).all()
        return len(metrics_ids) == len(dataset_query)

    @staticmethod
    def find_by_id(model_id: int) -> SqlaTable:
        data_model = SQLAInterface(SqlaTable, db.session)
        query = db.session.query(SqlaTable)
        query = DatasourceFilter("id", data_model).apply(query, None)
        return query.filter_by(id=model_id).one_or_none()

    @staticmethod
    def create(properties: Dict, commit=True) -> Optional[SqlaTable]:
        return generic_create(SqlaTable, properties, commit=commit)

    @staticmethod
    def update(model: SqlaTable, properties: Dict, commit=True) -> Optional[SqlaTable]:
        """
        Updates a Dataset model on the metadata DB
        """
        if "columns" in properties:
            new_columns = list()
            for column in properties.get("columns", []):
                if column.get("id"):
                    column_obj = db.session.query(TableColumn).get(column.get("id"))
                    column_obj = DatasetDAO.update_column(
                        column_obj, column, commit=commit
                    )
                else:
                    column_obj = DatasetDAO.create_column(column, commit=commit)
                new_columns.append(column_obj)
            properties["columns"] = new_columns

        if "metrics" in properties:
            new_metrics = list()
            for metric in properties.get("metrics", []):
                if metric.get("id"):
                    metric_obj = db.session.query(SqlMetric).get(metric.get("id"))
                    metric_obj = DatasetDAO.update_metric(
                        metric_obj, metric, commit=commit
                    )
                else:
                    metric_obj = DatasetDAO.create_metric(metric, commit=commit)
                new_metrics.append(metric_obj)
            properties["metrics"] = new_metrics

        return generic_update(model, properties, commit=commit)

    @staticmethod
    def delete(model: SqlaTable, commit=True):
        return generic_delete(model, commit=commit)

    @staticmethod
    def update_column(
        model: TableColumn, properties: Dict, commit=True
    ) -> Optional[TableColumn]:
        return generic_update(model, properties, commit=commit)

    @staticmethod
    def create_column(properties: Dict, commit=True) -> Optional[TableColumn]:
        """
        Creates a Dataset model on the metadata DB
        """
        return generic_create(TableColumn, properties, commit=commit)

    @staticmethod
    def update_metric(
        model: SqlMetric, properties: Dict, commit=True
    ) -> Optional[SqlMetric]:
        return generic_update(model, properties, commit=commit)

    @staticmethod
    def create_metric(properties: Dict, commit=True) -> Optional[SqlMetric]:
        """
        Creates a Dataset model on the metadata DB
        """
        return generic_create(SqlMetric, properties, commit=commit)
