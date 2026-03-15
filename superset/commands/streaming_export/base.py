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
"""Base command for streaming CSV exports."""

from __future__ import annotations

import csv
import io
import logging
import time
from abc import abstractmethod
from contextlib import contextmanager
from typing import Any, Callable, Generator

from flask import current_app as app, g, has_app_context
from sqlalchemy import text

from superset import db
from superset.commands.base import BaseCommand

logger = logging.getLogger(__name__)


@contextmanager
def preserve_g_context(
    captured_g: dict[str, Any],
) -> Generator[None, None, None]:
    """
    Context manager that restores captured flask.g attributes.

    This is needed for streaming responses where the generator runs in a new
    app context but needs access to request-scoped data from the original request.

    Args:
        captured_g: Dictionary of g attributes captured before context switch
    """
    for key, value in captured_g.items():
        setattr(g, key, value)
    yield


class BaseStreamingCSVExportCommand(BaseCommand):
    """
    Base class for streaming CSV export commands.

    Provides shared functionality for:
    - Generating CSV data in chunks
    - Managing database connections
    - Buffering data for efficient streaming
    - Error handling with user-friendly messages

    Subclasses must implement:
    - _get_sql_and_database(): Return SQL query string and database object
    - _get_row_limit(): Return optional row limit for the export
    """

    def __init__(self, chunk_size: int = 1000):
        """
        Initialize the streaming export command.

        Args:
            chunk_size: Number of rows to fetch per database query (default: 1000)
        """
        self._chunk_size = chunk_size
        self._current_app = app._get_current_object()

    @abstractmethod
    def _get_sql_and_database(self) -> tuple[str, Any]:
        """
        Get the SQL query and database for execution.

        Returns:
            Tuple of (sql_query, database_object)
        """

    @abstractmethod
    def _get_row_limit(self) -> int | None:
        """
        Get the row limit for the export.

        Returns:
            Row limit or None for unlimited
        """

    def _write_csv_header(
        self, columns: list[str], csv_writer: Any, buffer: io.StringIO
    ) -> tuple[str, int]:
        """Write CSV header and return header data with byte count."""
        csv_writer.writerow(columns)
        header_data = buffer.getvalue()
        total_bytes = len(header_data.encode("utf-8"))
        buffer.seek(0)
        buffer.truncate()
        return header_data, total_bytes

    def _format_row_values(
        self, row: tuple[Any, ...], decimal_separator: str | None
    ) -> list[Any]:
        """
        Format row values, applying custom decimal separator if specified.

        Args:
            row: Database row as a tuple
            decimal_separator: Custom decimal separator (e.g., ",") or None

        Returns:
            List of formatted values
        """
        if not decimal_separator or decimal_separator == ".":
            return list(row)

        formatted = []
        for value in row:
            if isinstance(value, float):
                # Format float with custom decimal separator
                formatted.append(str(value).replace(".", decimal_separator))
            else:
                formatted.append(value)
        return formatted

    def _process_rows(
        self,
        result_proxy: Any,
        csv_writer: Any,
        buffer: io.StringIO,
        limit: int | None,
        decimal_separator: str | None = None,
    ) -> Generator[tuple[str, int, int], None, None]:
        """
        Process database rows and yield CSV data chunks.

        Args:
            result_proxy: SQLAlchemy result proxy
            csv_writer: CSV writer instance
            buffer: StringIO buffer for CSV data
            limit: Maximum number of rows to process, or None for unlimited
            decimal_separator: Custom decimal separator (e.g., ",") or None

        Yields tuples of (data_chunk, row_count, byte_count).
        """
        row_count = 0
        flush_threshold = 65536  # 64KB

        while rows := result_proxy.fetchmany(self._chunk_size):
            for row in rows:
                # Apply limit if specified
                if limit is not None and row_count >= limit:
                    break

                # Format values with custom decimal separator if needed
                formatted_row = self._format_row_values(row, decimal_separator)
                csv_writer.writerow(formatted_row)
                row_count += 1

                # Check buffer size and flush if needed
                current_size = buffer.tell()
                if current_size >= flush_threshold:
                    data = buffer.getvalue()
                    data_bytes = len(data.encode("utf-8"))
                    yield data, row_count, data_bytes
                    buffer.seek(0)
                    buffer.truncate()

            # Break outer loop if limit reached
            if limit is not None and row_count >= limit:
                break

        # Flush remaining buffer
        if remaining_data := buffer.getvalue():
            data_bytes = len(remaining_data.encode("utf-8"))
            yield remaining_data, row_count, data_bytes

    def _execute_query_and_stream(
        self, sql: str, database: Any, limit: int | None
    ) -> Generator[str, None, None]:
        """Execute query with streaming and yield CSV chunks."""
        start_time = time.time()
        total_bytes = 0

        # Get CSV export configuration
        csv_export_config = app.config.get("CSV_EXPORT", {})
        delimiter = csv_export_config.get("sep", ",")
        decimal_separator = csv_export_config.get("decimal", ".")

        with db.session() as session:
            # Merge database to prevent DetachedInstanceError
            merged_database = session.merge(database)

            # Execute query with streaming
            with merged_database.get_sqla_engine() as engine:
                with engine.connect() as connection:
                    result_proxy = connection.execution_options(
                        stream_results=True
                    ).execute(text(sql))

                    columns = list(result_proxy.keys())

                    # Use StringIO with csv.writer for proper escaping
                    # Apply delimiter from CSV_EXPORT config
                    buffer = io.StringIO()
                    csv_writer = csv.writer(
                        buffer, delimiter=delimiter, quoting=csv.QUOTE_MINIMAL
                    )

                    # Write CSV header
                    header_data, header_bytes = self._write_csv_header(
                        columns, csv_writer, buffer
                    )
                    total_bytes += header_bytes
                    yield header_data

                    # Process rows and yield chunks
                    row_count = 0
                    for data_chunk, rows_processed, chunk_bytes in self._process_rows(
                        result_proxy, csv_writer, buffer, limit, decimal_separator
                    ):
                        total_bytes += chunk_bytes
                        row_count = rows_processed
                        yield data_chunk

                    # Log completion
                    total_time = time.time() - start_time
                    total_mb = total_bytes / (1024 * 1024)
                    logger.info(
                        "Streaming CSV completed: %s rows, %.1fMB in %.2fs",
                        f"{row_count:,}",
                        total_mb,
                        total_time,
                    )

    def run(self) -> Callable[[], Generator[str, None, None]]:
        """
        Execute the streaming CSV export.

        Returns:
            A callable that returns a generator yielding CSV data chunks as strings.
            The callable is needed to maintain Flask app context during streaming.
        """
        # Load all needed data while session is still active
        # to avoid DetachedInstanceError
        sql, database = self._get_sql_and_database()
        limit = self._get_row_limit()
        # Capture flask.g attributes to preserve request-scoped data
        # when the streaming generator runs in a new app context.
        captured_g = (
            g._get_current_object().__dict__.copy() if has_app_context() else {}
        )

        def csv_generator() -> Generator[str, None, None]:
            """Generator that yields CSV data chunks."""
            with self._current_app.app_context():
                with preserve_g_context(captured_g):
                    try:
                        yield from self._execute_query_and_stream(sql, database, limit)
                    except Exception as e:
                        logger.error("Error in streaming CSV generator: %s", e)
                        import traceback

                        logger.error("Traceback: %s", traceback.format_exc())

                        # Send error marker for frontend to detect
                        error_marker = (
                            "__STREAM_ERROR__:Export failed. "
                            "Please try again in some time.\n"
                        )
                        yield error_marker

        return csv_generator
