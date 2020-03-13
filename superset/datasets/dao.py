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
from typing import Dict, Optional

from flask import current_app
from flask_appbuilder.models.sqla.interface import SQLAInterface
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.exceptions import (
    CreateFailedError,
    DeleteFailedError,
    UpdateFailedError,
)
from superset.connectors.sqla.models import SqlaTable
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
    def find_by_id(model_id: int) -> SqlaTable:
        data_model = SQLAInterface(SqlaTable, db.session)
        query = db.session.query(SqlaTable)
        query = DatasourceFilter("id", data_model).apply(query, None)
        return query.filter_by(id=model_id).one_or_none()

    @staticmethod
    def create(properties: Dict, commit=True) -> Optional[SqlaTable]:
        model = SqlaTable()
        for key, value in properties.items():
            setattr(model, key, value)
        try:
            db.session.add(model)
            if commit:
                db.session.commit()
        except SQLAlchemyError as e:  # pragma: no cover
            db.session.rollback()
            raise CreateFailedError(exception=e)
        return model

    @staticmethod
    def update(model: SqlaTable, properties: Dict, commit=True) -> Optional[SqlaTable]:
        for key, value in properties.items():
            setattr(model, key, value)
        try:
            db.session.merge(model)
            if commit:
                db.session.commit()
        except SQLAlchemyError as e:  # pragma: no cover
            db.session.rollback()
            raise UpdateFailedError(exception=e)
        return model

    @staticmethod
    def delete(model: SqlaTable, commit=True):
        try:
            db.session.delete(model)
            if commit:
                db.session.commit()
        except SQLAlchemyError as e:  # pragma: no cover
            logger.error(f"Failed to delete dataset: {e}")
            db.session.rollback()
            raise DeleteFailedError(exception=e)
        return model
