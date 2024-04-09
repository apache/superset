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
)
from superset.connectors.sqla.models import SqlaTable
from superset.daos.database import DatabaseDAO
from superset.models.core import Database
from superset.sql_parse import Table
from superset.utils.core import get_user
from superset.views.database.validators import schema_allows_file_upload

logger = logging.getLogger(__name__)

READ_CSV_CHUNK_SIZE = 1000


class CSVImportOptions(TypedDict, total=False):
    schema: str
    delimiter: str
    already_exists: str
    column_data_types: dict[str, str]
    column_dates: list[str]
    column_labels: str
    columns_read: list[str]
    dataframe_index: str
    day_first: bool
    decimal_character: str
    header_row: int
    index_column: str
    null_values: list[str]
    overwrite_duplicates: bool
    rows_to_read: int
    skip_blank_lines: bool
    skip_initial_space: bool
    skip_rows: bool


class CSVImportCommand(BaseCommand):
    def __init__(
        self,
        model_id: int,
        table_name: str,
        file: Any,
        options: CSVImportOptions,
    ) -> None:
        self._model_id = model_id
        self._model: Optional[Database] = None
        self._table_name = table_name
        self._schema = options.get("schema")
        self._file = file
        self._options = options

    def run(self) -> None:
        self.validate()
        if not self._model:
            return
        try:
            df = pd.concat(
                pd.read_csv(
                    chunksize=READ_CSV_CHUNK_SIZE,
                    encoding="utf-8",
                    filepath_or_buffer=self._file,
                    header=self._options.get("header_row", 0),
                    index_col=self._options.get("index_column"),
                    dayfirst=self._options.get("day_first", False),
                    iterator=True,
                    keep_default_na=not self._options.get("null_values"),
                    usecols=self._options.get("columns_read")
                    if self._options.get("columns_read")
                    else None,
                    na_values=self._options.get("null_values")
                    if self._options.get("null_values")
                    else None,
                    nrows=self._options.get("rows_to_read"),
                    parse_dates=self._options.get("column_dates"),
                    sep=self._options.get("delimiter", ","),
                    skip_blank_lines=self._options.get("skip_blank_lines", False),
                    skipinitialspace=self._options.get("skip_initial_space", False),
                    skiprows=self._options.get("skip_rows", 0),
                    dtype=self._options.get("column_data_types")
                    if self._options.get("column_data_types")
                    else {},
                )
            )
            csv_table = Table(table=self._table_name, schema=self._schema)
            self._model.db_engine_spec.df_to_sql(
                self._model,
                csv_table,
                df,
                to_sql_kwargs={
                    "chunksize": READ_CSV_CHUNK_SIZE,
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
        sqla_table = (
            db.session.query(SqlaTable)
            .filter_by(
                table_name=self._table_name,
                schema=self._schema,
                database_id=self._model_id,
            )
            .one_or_none()
        )
        if sqla_table:
            sqla_table.fetch_metadata()
        if not sqla_table:
            sqla_table = SqlaTable(
                table_name=self._table_name,
                database=self._model,
                database_id=self._model_id,
                owners=[get_user()],
                schema=self._schema,
            )
            sqla_table.fetch_metadata()
            db.session.add(sqla_table)
        try:
            db.session.commit()
        except SQLAlchemyError as ex:
            db.session.rollback()
            raise ex

    def validate(self) -> None:
        self._model = DatabaseDAO.find_by_id(self._model_id)
        if not self._model:
            raise DatabaseNotFoundError()
        if not schema_allows_file_upload(self._model, self._schema):
            raise DatabaseSchemaUploadNotAllowed()
