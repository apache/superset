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
from typing import Any, Optional

import pandas as pd
from flask_babel import lazy_gettext as _
from werkzeug.datastructures import FileStorage

from superset.commands.database.exceptions import DatabaseUploadFailed
from superset.commands.database.uploaders.base import (
    BaseDataReader,
    FileMetadata,
    ReaderOptions,
)

logger = logging.getLogger(__name__)

READ_CSV_CHUNK_SIZE = 1000
ROWS_TO_READ_METADATA = 2


class CSVReaderOptions(ReaderOptions, total=False):
    delimiter: str
    column_data_types: dict[str, str]
    column_dates: list[str]
    columns_read: list[str]
    index_column: str
    day_first: bool
    decimal_character: str
    header_row: int
    null_values: list[str]
    rows_to_read: int
    skip_blank_lines: bool
    skip_initial_space: bool
    skip_rows: int


class CSVReader(BaseDataReader):
    def __init__(
        self,
        options: Optional[CSVReaderOptions] = None,
    ) -> None:
        options = options or {}
        super().__init__(
            options=dict(options),
        )

    @staticmethod
    def _read_csv(file: FileStorage, kwargs: dict[str, Any]) -> pd.DataFrame:
        try:
            if "chunksize" in kwargs:
                return pd.concat(
                    pd.read_csv(
                        filepath_or_buffer=file.stream,
                        **kwargs,
                    )
                )
            return pd.read_csv(
                filepath_or_buffer=file.stream,
                **kwargs,
            )
        except ValueError as ex:
            error_str = str(ex)   
            if "invalid literal for int() with base 10:" in error_str:
                invalid_value = error_str.split(":")[-1].strip().strip("'")

                int_columns = []
                problematic_column = None

                if kwargs.get("dtype"):
                    int_columns = [
                        col for col, dtype in kwargs["dtype"].items() 
                        if dtype == "int" or dtype == "integer"
                    ]
                    kwargs.pop("dtype", None)
                    file.stream.seek(0)
                    df = pd.concat(
                        pd.read_csv(
                            filepath_or_buffer=file.stream,
                            **kwargs
                        )
                    )

                    for col in int_columns:
                        mask = df[col] == invalid_value
                        if mask.any():
                            problematic_column = col
                            line_number = mask.idxmax() + kwargs.get('header', 0) + 1
                            break

                    error_msg =  f"Non-numeric value '{invalid_value}' found on column '{problematic_column}' line {line_number}"

                raise DatabaseUploadFailed(message=error_msg) from ex
           
            raise DatabaseUploadFailed(
                message=_("Parsing error: %(error)s", error=error_str)
            ) from ex

        except (
            pd.errors.ParserError,
            pd.errors.EmptyDataError,
            UnicodeDecodeError
        ) as ex:
            raise DatabaseUploadFailed(
                message=_("Parsing error: %(error)s", error=str(ex))
            ) from ex
        except Exception as ex:
            raise DatabaseUploadFailed(_("Error reading CSV file")) from ex

    def file_to_dataframe(self, file: FileStorage) -> pd.DataFrame:
        """
        Read CSV file into a DataFrame

        :return: pandas DataFrame
        :throws DatabaseUploadFailed: if there is an error reading the file
        """
        kwargs = {
            "chunksize": READ_CSV_CHUNK_SIZE,
            "encoding": "utf-8",
            "header": self._options.get("header_row", 0),
            "decimal": self._options.get("decimal_character", "."),
            "index_col": self._options.get("index_column"),
            "dayfirst": self._options.get("day_first", False),
            "iterator": True,
            "keep_default_na": not self._options.get("null_values"),
            "usecols": self._options.get("columns_read")
            if self._options.get("columns_read")  # None if an empty list
            else None,
            "na_values": self._options.get("null_values")
            if self._options.get("null_values")  # None if an empty list
            else None,
            "nrows": self._options.get("rows_to_read"),
            "parse_dates": self._options.get("column_dates"),
            "sep": self._options.get("delimiter", ","),
            "skip_blank_lines": self._options.get("skip_blank_lines", False),
            "skipinitialspace": self._options.get("skip_initial_space", False),
            "skiprows": self._options.get("skip_rows", 0),
            "dtype": self._options.get("column_data_types")
            if self._options.get("column_data_types")
            else None,
        }
        return self._read_csv(file, kwargs)

    def file_metadata(self, file: FileStorage) -> FileMetadata:
        """
        Get metadata from a CSV file

        :return: FileMetadata
        :throws DatabaseUploadFailed: if there is an error reading the file
        """
        kwargs = {
            "nrows": ROWS_TO_READ_METADATA,
            "header": self._options.get("header_row", 0),
            "sep": self._options.get("delimiter", ","),
        }
        df = self._read_csv(file, kwargs)
        return {
            "items": [
                {
                    "column_names": df.columns.tolist(),
                    "sheet_name": None,
                }
            ]
        }
