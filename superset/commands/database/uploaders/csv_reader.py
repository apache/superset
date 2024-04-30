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
from typing import Any

import pandas as pd
from flask_babel import lazy_gettext as _

from superset.commands.database.exceptions import DatabaseUploadFailed
from superset.commands.database.uploaders.base import BaseDataReader, ReaderOptions

logger = logging.getLogger(__name__)

READ_CSV_CHUNK_SIZE = 1000


class CSVReaderOptions(ReaderOptions, total=False):
    delimiter: str
    column_data_types: dict[str, str]
    column_dates: list[str]
    columns_read: list[str]
    dataframe_index: str
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
        options: CSVReaderOptions,
    ) -> None:
        super().__init__(
            options=dict(options),
        )

    def file_to_dataframe(self, file: Any) -> pd.DataFrame:
        """
        Read CSV file into a DataFrame

        :return: pandas DataFrame
        :throws DatabaseUploadFailed: if there is an error reading the CSV file
        """
        try:
            return pd.concat(
                pd.read_csv(
                    chunksize=READ_CSV_CHUNK_SIZE,
                    encoding="utf-8",
                    filepath_or_buffer=file,
                    header=self._options.get("header_row", 0),
                    decimal=self._options.get("decimal_character", "."),
                    index_col=self._options.get("index_column"),
                    dayfirst=self._options.get("day_first", False),
                    iterator=True,
                    keep_default_na=not self._options.get("null_values"),
                    usecols=self._options.get("columns_read")
                    if self._options.get("columns_read")  # None if an empty list
                    else None,
                    na_values=self._options.get("null_values")
                    if self._options.get("null_values")  # None if an empty list
                    else None,
                    nrows=self._options.get("rows_to_read"),
                    parse_dates=self._options.get("column_dates"),
                    sep=self._options.get("delimiter", ","),
                    skip_blank_lines=self._options.get("skip_blank_lines", False),
                    skipinitialspace=self._options.get("skip_initial_space", False),
                    skiprows=self._options.get("skip_rows", 0),
                    dtype=self._options.get("column_data_types")
                    if self._options.get("column_data_types")
                    else None,
                )
            )
        except (
            pd.errors.ParserError,
            pd.errors.EmptyDataError,
            UnicodeDecodeError,
            ValueError,
        ) as ex:
            raise DatabaseUploadFailed(
                message=_("Parsing error: %(error)s", error=str(ex))
            ) from ex
        except Exception as ex:
            raise DatabaseUploadFailed(_("Error reading CSV file")) from ex
