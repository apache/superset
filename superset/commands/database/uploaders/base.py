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
from abc import abstractmethod
from typing import Any, Optional, TypedDict

import pandas as pd
from flask_babel import lazy_gettext as _
from sqlalchemy.exc import SQLAlchemyError

from superset import db
from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import (
    DatabaseNotFoundError,
    DatabaseSchemaUploadNotAllowed,
    DatabaseUploadFailed,
    DatabaseUploadNotSupported,
    DatabaseUploadSaveMetadataFailed,
)
from superset.connectors.sqla.models import SqlaTable
from superset.daos.database import DatabaseDAO
from superset.models.core import Database
from superset.sql_parse import Table
from superset.utils.core import get_user
from superset.views.database.validators import schema_allows_file_upload

logger = logging.getLogger(__name__)

READ_CHUNK_SIZE = 1000


class ReaderOptions(TypedDict, total=False):
    already_exists: str
    column_labels: str
    index_column: str


class BaseDataReader:
    """
    Base class for reading data from a file and uploading it to a database
    These child objects are used by the UploadCommand as a dependency injection
    to read data from multiple file types (e.g. CSV, Excel, etc.)
    """

    def __init__(self, options: dict[str, Any]) -> None:
        self._options = options

    @abstractmethod
    def file_to_dataframe(self, file: Any) -> pd.DataFrame:
        ...

    def read(
        self, file: Any, database: Database, table_name: str, schema_name: Optional[str]
    ) -> None:
        self._dataframe_to_database(
            self.file_to_dataframe(file), database, table_name, schema_name
        )

    def _dataframe_to_database(
        self,
        df: pd.DataFrame,
        database: Database,
        table_name: str,
        schema_name: Optional[str],
    ) -> None:
        """
        Upload DataFrame to database

        :param df:
        :throws DatabaseUploadFailed: if there is an error uploading the DataFrame
        """
        try:
            data_table = Table(table=table_name, schema=schema_name)
            database.db_engine_spec.df_to_sql(
                database,
                data_table,
                df,
                to_sql_kwargs={
                    "chunksize": READ_CHUNK_SIZE,
                    "if_exists": self._options.get("already_exists", "fail"),
                    "index": self._options.get("index_column"),
                    "index_label": self._options.get("column_labels"),
                },
            )
        except ValueError as ex:
            raise DatabaseUploadFailed(
                message=_(
                    "Table already exists. You can change your "
                    "'if table already exists' strategy to append or "
                    "replace or provide a different Table Name to use."
                )
            ) from ex
        except Exception as ex:
            raise DatabaseUploadFailed(exception=ex) from ex


class UploadCommand(BaseCommand):
    def __init__(  # pylint: disable=too-many-arguments
        self,
        model_id: int,
        table_name: str,
        file: Any,
        schema: Optional[str],
        reader: BaseDataReader,
    ) -> None:
        self._model_id = model_id
        self._model: Optional[Database] = None
        self._table_name = table_name
        self._schema = schema
        self._file = file
        self._reader = reader

    def run(self) -> None:
        self.validate()
        if not self._model:
            return

        self._reader.read(self._file, self._model, self._table_name, self._schema)

        sqla_table = (
            db.session.query(SqlaTable)
            .filter_by(
                table_name=self._table_name,
                schema=self._schema,
                database_id=self._model_id,
            )
            .one_or_none()
        )
        if not sqla_table:
            sqla_table = SqlaTable(
                table_name=self._table_name,
                database=self._model,
                database_id=self._model_id,
                owners=[get_user()],
                schema=self._schema,
            )
            db.session.add(sqla_table)

        sqla_table.fetch_metadata()

        try:
            db.session.commit()
        except SQLAlchemyError as ex:
            db.session.rollback()
            raise DatabaseUploadSaveMetadataFailed() from ex

    def validate(self) -> None:
        self._model = DatabaseDAO.find_by_id(self._model_id)
        if not self._model:
            raise DatabaseNotFoundError()
        if not schema_allows_file_upload(self._model, self._schema):
            raise DatabaseSchemaUploadNotAllowed()
        if not self._model.db_engine_spec.supports_file_upload:
            raise DatabaseUploadNotSupported()
