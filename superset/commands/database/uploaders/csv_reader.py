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

# Fixed error limit to avoid huge payloads and poor UX given that a file
# might contain thousands of errors.
MAX_DISPLAYED_ERRORS = 5

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
                "Error selecting CSV engine: %s, falling back to 'c' engine", ex
            )
            return "c"

    @staticmethod
    def _find_invalid_values_numeric(df: pd.DataFrame, column: str) -> pd.Series:
        """
        Find invalid values for numeric type conversion.

        Identifies rows where values cannot be converted to numeric types using
        pandas to_numeric with error coercing. Returns a boolean mask indicating
        which values are invalid (non-null but unconvertible).

        :param df: DataFrame containing the data
        :param column: Name of the column to check for invalid values

        :return: Boolean Series indicating which rows have invalid
        values for numeric conversion
        """
        converted = pd.to_numeric(df[column], errors="coerce")
        return converted.isna() & df[column].notna()

    @staticmethod
    def _find_invalid_values_non_numeric(
        df: pd.DataFrame, column: str, dtype: str
    ) -> pd.Series:
        """
        Find invalid values for non-numeric type conversion.

        Identifies rows where values cannot be converted to the specified non-numeric
        data type by attempting conversion and catching exceptions. This is used for
        string, categorical, or other non-numeric type conversions.

        :param df: DataFrame containing the data
        :param column: Name of the column to check for invalid values
        :param dtype: Target data type for conversion (e.g., 'string', 'category')

        :return: Boolean Series indicating which rows have
        invalid values for the target type
        """
        invalid_mask = pd.Series([False] * len(df), index=df.index)
        for idx, value in df[column].items():
            if pd.notna(value):
                try:
                    pd.Series([value]).astype(dtype)
                except (ValueError, TypeError):
                    invalid_mask[idx] = True
        return invalid_mask

    @staticmethod
    def _get_error_details(
        df: pd.DataFrame,
        column: str,
        dtype: str,
        invalid_mask: pd.Series,
        kwargs: dict[str, Any],
    ) -> tuple[list[str], int]:
        """
        Get detailed error information for invalid values in type conversion.

        Extracts detailed information about conversion errors, including specific
        invalid values and their line numbers. Limits the number of detailed errors
        shown to avoid overwhelming output while providing total error count.

        :param df: DataFrame containing the data
        :param column: Name of the column with conversion errors
        :param dtype: Target data type that failed conversion
        :param invalid_mask: Boolean mask indicating which rows have invalid values
        :param kwargs: Additional parameters including header row information

        :return: Tuple containing:
            - List of formatted error detail strings (limited by MAX_DISPLAYED_ERRORS)
            - Total count of errors found
        """
        if not invalid_mask.any():
            return [], 0

        invalid_indices = invalid_mask[invalid_mask].index.tolist()
        total_errors = len(invalid_indices)

        error_details = []
        for idx in invalid_indices[:MAX_DISPLAYED_ERRORS]:
            invalid_value = df.loc[idx, column]
            line_number = idx + kwargs.get("header", 0) + 2
            error_details.append(
                "  • Line %s: '%s' cannot be converted to %s"
                % (line_number, invalid_value, dtype)
            )

        return error_details, total_errors

    @staticmethod
    def _create_error_message(
        df: pd.DataFrame,
        column: str,
        dtype: str,
        invalid_mask: pd.Series,
        kwargs: dict[str, Any],
        original_error: Exception,
    ) -> str:
        """
        Create detailed error message for type conversion failure.

        Constructs a comprehensive error message that includes:
        - Column name and target type
        - Total count of errors found
        - Detailed list of first few errors with line numbers and values
        - Summary of remaining errors if exceeding display limit

        :param df: DataFrame containing the data
        :param column: Name of the column that failed conversion
        :param dtype: Target data type that failed
        :param invalid_mask: Boolean mask indicating which rows have invalid values
        :param kwargs: Additional parameters including header information
        :param original_error: Original exception that triggered the error handling

        :return: Formatted error message string ready for display to user
        """
        error_details, total_errors = CSVReader._get_error_details(
            df, column, dtype, invalid_mask, kwargs
        )

        if error_details:
            base_msg = (
                f"Cannot convert column '{column}' to {dtype}. "
                f"Found {total_errors} error(s):"
            )
            detailed_errors = "\n".join(error_details)

            if total_errors > MAX_DISPLAYED_ERRORS:
                remaining = total_errors - MAX_DISPLAYED_ERRORS
                additional_msg = f"\n  ... and {remaining} more error(s)"
                return f"{base_msg}\n{detailed_errors}{additional_msg}"
            else:
                return f"{base_msg}\n{detailed_errors}"
        else:
            return f"Cannot convert column '{column}' to {dtype}. {str(original_error)}"

    @staticmethod
    def _cast_single_column(
        df: pd.DataFrame, column: str, dtype: str, kwargs: dict[str, Any]
    ) -> None:
        """
        Cast a single DataFrame column to the specified data type.

        Attempts to convert a column to the target data type with enhanced error
        handling. For numeric types, uses pandas to_numeric for better performance
        and error detection. If conversion fails, provides detailed
        error messages including specific invalid values and their line numbers.

        :param df: DataFrame to modify (modified in-place)
        :param column: Name of the column to cast
        :param dtype: Target data type (e.g., 'int64', 'float64', 'string')
        :param kwargs: Additional parameters including header row information

        :raises DatabaseUploadFailed: If type conversion fails,
        with detailed error message
        """
        numeric_types = {"int64", "int32", "float64", "float32"}

        try:
            if dtype in numeric_types:
                df[column] = pd.to_numeric(df[column], errors="raise")
                df[column] = df[column].astype(dtype)
            else:
                df[column] = df[column].astype(dtype)
        except (ValueError, TypeError) as ex:
            try:
                if dtype in numeric_types:
                    invalid_mask = CSVReader._find_invalid_values_numeric(df, column)
                else:
                    invalid_mask = CSVReader._find_invalid_values_non_numeric(
                        df, column, dtype
                    )

                error_msg = CSVReader._create_error_message(
                    df, column, dtype, invalid_mask, kwargs, ex
                )
            except Exception:
                error_msg = f"Cannot convert column '{column}' to {dtype}. {str(ex)}"

            raise DatabaseUploadFailed(message=error_msg) from ex

    @staticmethod
    def _cast_column_types(
        df: pd.DataFrame, types: dict[str, str], kwargs: dict[str, Any]
    ) -> pd.DataFrame:
        """
        Cast DataFrame columns to specified types with detailed
        error reporting.

        :param df: DataFrame to cast
        :param types: Dictionary mapping column names to target types
        :param kwargs: Original read_csv kwargs for line number calculation
        :return: DataFrame with casted columns
        :raises DatabaseUploadFailed: If type conversion fails with detailed error info
        """
        for column, dtype in types.items():
            if column not in df.columns:
                continue
            CSVReader._cast_single_column(df, column, dtype, kwargs)
        return df

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
                df = CSVReader._cast_column_types(df, types, kwargs)

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
