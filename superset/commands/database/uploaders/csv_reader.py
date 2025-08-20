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
from importlib import util
from typing import Any, Optional

import pandas as pd
from flask import current_app
from flask_babel import lazy_gettext as _
from werkzeug.datastructures import FileStorage

from superset import is_feature_enabled
from superset.commands.database.exceptions import DatabaseUploadFailed
from superset.commands.database.uploaders.base import (
    BaseDataReader,
    FileMetadata,
    ReaderOptions,
)

logger = logging.getLogger(__name__)

ROWS_TO_READ_METADATA = 100
DEFAULT_ENCODING = "utf-8"
ENCODING_FALLBACKS = ["utf-8", "latin-1", "cp1252", "iso-8859-1"]


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
    def _detect_encoding(file: FileStorage) -> str:
        """Detect file encoding with progressive sampling"""
        # Try progressively larger samples to improve detection reliability
        sample_sizes = [1024, 8192, 32768, 65536]

        for sample_size in sample_sizes:
            file.seek(0)
            sample = file.read(sample_size)
            if not sample:  # Empty file or reached end
                break

            for encoding in ENCODING_FALLBACKS:
                try:
                    sample.decode(encoding)
                    file.seek(0)
                    return encoding
                except UnicodeDecodeError:
                    continue

        file.seek(0)
        return DEFAULT_ENCODING

    @staticmethod
    def _select_optimal_engine() -> str:
        """Select the best available CSV parsing engine"""
        try:
            # Check if pyarrow is available as a separate package
            pyarrow_spec = util.find_spec("pyarrow")
            if not pyarrow_spec:
                return "c"

            # Import pyarrow to verify it works properly
            import pyarrow as pa  # noqa: F401

            # Check if pandas has built-in pyarrow support
            pandas_version = str(pd.__version__)
            has_builtin_pyarrow = "pyarrow" in pandas_version

            if has_builtin_pyarrow:
                # Pandas has built-in pyarrow, safer to use c engine
                logger.info("Pandas has built-in pyarrow support, using 'c' engine")
                return "c"
            else:
                # External pyarrow available, can safely use it
                logger.info("Using 'pyarrow' engine for CSV parsing")
                return "pyarrow"

        except ImportError:
            # PyArrow import failed, fall back to c engine
            logger.info("PyArrow not properly installed, falling back to 'c' engine")
            return "c"
        except Exception as ex:
            # Any other error, fall back to c engine
            logger.warning(
                f"Error selecting CSV engine: {ex}, falling back to 'c' engine"
            )
            return "c"

    @staticmethod
    def _read_csv(  # noqa: C901
        file: FileStorage,
        kwargs: dict[str, Any],
    ) -> pd.DataFrame:
        encoding = kwargs.get("encoding", DEFAULT_ENCODING)

        # PyArrow engine doesn't support iterator/chunksize/nrows
        # It also has known issues with date parsing and missing values
        # Default to "c" engine for stability
        has_unsupported_options = (
            "chunksize" in kwargs
            or "iterator" in kwargs
            or kwargs.get("nrows") is not None
            or kwargs.get("parse_dates")  # Has bugs with multiple date columns
            or kwargs.get("na_values")  # Has bugs with missing value handling
        )

        # Use PyArrow engine if feature flag is enabled and options are compatible
        if (
            is_feature_enabled("CSV_UPLOAD_PYARROW_ENGINE")
            and not has_unsupported_options
        ):
            kwargs["engine"] = CSVReader._select_optimal_engine()
        else:
            # Default to c engine for reliability
            kwargs["engine"] = "c"

        kwargs["low_memory"] = False

        try:
            types = kwargs.pop("dtype", None)
            if "chunksize" in kwargs:
                chunks = []
                total_rows = 0
                max_rows = kwargs.get("nrows")
                chunk_iterator = pd.read_csv(
                    filepath_or_buffer=file.stream,
                    **kwargs,
                )

                for chunk in chunk_iterator:
                    # Check if adding this chunk would exceed the row limit
                    if max_rows is not None and total_rows + len(chunk) > max_rows:
                        # Only take the needed rows from this chunk
                        remaining_rows = max_rows - total_rows
                        chunk = chunk.iloc[:remaining_rows]
                        chunks.append(chunk)
                        break

                    chunks.append(chunk)
                    total_rows += len(chunk)

                    # Break if we've reached the desired number of rows
                    if max_rows is not None and total_rows >= max_rows:
                        break

                if chunks:
                    result = pd.concat(chunks, ignore_index=False)
                    # When using chunking, we need to reset and rebuild the index
                    if kwargs.get("index_col") is not None:
                        # The index was already set by pandas during read_csv
                        # Just need to ensure it's properly named after concatenation
                        index_col = kwargs.get("index_col")
                        if isinstance(index_col, str):
                            result.index.name = index_col
                    df = result
            else:
                df = pd.read_csv(
                    filepath_or_buffer=file.stream,
                    **kwargs,
                )

            if types:
                for column, dtype in types.items():
                    try:
                        df[column] = df[column].astype(dtype)
                    except ValueError as ex:
                        error_msg = f"Non {dtype} value found in column '{column}'."
                        ex_msg = str(ex)
                        invalid_value = ex_msg.split(":")[-1].strip().strip("'")
                        error_msg += (
                            f" Value: '{invalid_value}'" if invalid_value else ""
                        )
                        mask = df[column] == invalid_value
                        if mask.any() and invalid_value:
                            line_number = mask.idxmax() + kwargs.get("header", 0) + 1
                            error_msg += f", line: {line_number}."
                        raise DatabaseUploadFailed(message=error_msg) from ex
            return df
        except DatabaseUploadFailed:
            raise
        except UnicodeDecodeError as ex:
            if encoding != DEFAULT_ENCODING:
                raise DatabaseUploadFailed(
                    message=_("Parsing error: %(error)s", error=str(ex))
                ) from ex

            file.seek(0)
            detected_encoding = CSVReader._detect_encoding(file)
            if detected_encoding != encoding:
                kwargs["encoding"] = detected_encoding
                return CSVReader._read_csv(file, kwargs)
            raise DatabaseUploadFailed(
                message=_("Parsing error: %(error)s", error=str(ex))
            ) from ex
        except (
            pd.errors.ParserError,
            pd.errors.EmptyDataError,
            ValueError,
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
        rows_to_read = self._options.get("rows_to_read")
        chunk_size = current_app.config.get("READ_CSV_CHUNK_SIZE", 1000)

        use_chunking = rows_to_read is None or rows_to_read > chunk_size * 2

        kwargs = {
            "encoding": self._options.get("encoding", DEFAULT_ENCODING),
            "header": self._options.get("header_row", 0),
            "decimal": self._options.get("decimal_character", "."),
            "index_col": self._options.get("index_column"),
            "dayfirst": self._options.get("day_first", False),
            "keep_default_na": not self._options.get("null_values"),
            "usecols": (
                self._options.get("columns_read")
                if self._options.get("columns_read")  # None if an empty list
                else None
            ),
            "na_values": (
                self._options.get("null_values")
                if self._options.get("null_values")  # None if an empty list
                else None
            ),
            "nrows": rows_to_read,
            "parse_dates": self._options.get("column_dates"),
            "sep": self._options.get("delimiter", ","),
            "skip_blank_lines": self._options.get("skip_blank_lines", False),
            "skipinitialspace": self._options.get("skip_initial_space", False),
            "skiprows": self._options.get("skip_rows", 0),
            "dtype": (
                self._options.get("column_data_types")
                if self._options.get("column_data_types")
                else None
            ),
            "cache_dates": True,
        }

        if use_chunking:
            kwargs["chunksize"] = chunk_size
            kwargs["iterator"] = True

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
            "encoding": self._options.get("encoding", DEFAULT_ENCODING),
            "low_memory": False,
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
