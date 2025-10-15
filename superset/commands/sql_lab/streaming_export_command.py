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
"""Command for streaming CSV exports of SQL Lab query results."""

from __future__ import annotations

import csv
import io
import logging
import time
from typing import Any, Callable, Generator, TYPE_CHECKING

from flask import current_app as app
from flask_babel import gettext as __
from sqlalchemy import text

from superset import db
from superset.commands.base import BaseCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetErrorException, SupersetSecurityException
from superset.models.sql_lab import Query
from superset.sql.parse import SQLScript
from superset.sqllab.limiting_factor import LimitingFactor

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class StreamingSqlResultExportCommand(BaseCommand):
    """
    Command to execute a streaming CSV export of SQL Lab query results.

    This command handles the business logic for:
    - Fetching SQL Lab query results
    - Generating CSV data in chunks
    - Managing database connections
    - Buffering data for efficient streaming
    """

    def __init__(
        self,
        client_id: str,
        chunk_size: int = 1000,
    ):
        """
        Initialize the streaming export command.

        Args:
            client_id: The SQL Lab query client ID
            chunk_size: Number of rows to fetch per database query (default: 1000)
        """
        self._client_id = client_id
        self._chunk_size = chunk_size
        self._current_app = app._get_current_object()
        self._query: Query | None = None

    def validate(self) -> None:
        """Validate permissions and query existence."""
        self._query = (
            db.session.query(Query).filter_by(client_id=self._client_id).one_or_none()
        )
        if self._query is None:
            raise SupersetErrorException(
                SupersetError(
                    message=__(
                        "The query associated with these results could not be found. "
                        "You need to re-run the original query."
                    ),
                    error_type=SupersetErrorType.RESULTS_BACKEND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=404,
            )

        try:
            self._query.raise_for_access()
        except SupersetSecurityException as ex:
            raise SupersetErrorException(
                SupersetError(
                    message=__("Cannot access the query"),
                    error_type=SupersetErrorType.QUERY_SECURITY_ACCESS_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=403,
            ) from ex

    def _get_sql_and_limit(self) -> tuple[str, int | None]:
        """Get the SQL query and limit from the query object."""
        assert self._query is not None

        select_sql = self._query.select_sql
        executed_sql = self._query.executed_sql
        limiting_factor = self._query.limiting_factor
        database = self._query.database

        # Get the SQL and limit
        if select_sql:
            sql = select_sql
            limit = None
        else:
            sql = executed_sql
            script = SQLScript(sql, database.db_engine_spec.engine)
            # when a query has multiple statements only the last one returns data
            limit = script.statements[-1].get_limit_value()

        if limit is not None and limiting_factor in {
            LimitingFactor.QUERY,
            LimitingFactor.DROPDOWN,
            LimitingFactor.QUERY_AND_DROPDOWN,
        }:
            # remove extra row from `increased_limit`
            limit -= 1

        return sql, limit

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

    def _process_rows(
        self,
        result_proxy: Any,
        csv_writer: Any,
        buffer: io.StringIO,
        limit: int | None,
    ) -> Generator[tuple[str, int, int], None, None]:
        """
        Process database rows and yield CSV data chunks.

        Yields tuples of (data_chunk, row_count, byte_count).
        """
        row_count = 0
        flush_threshold = 65536  # 64KB

        while rows := result_proxy.fetchmany(self._chunk_size):
            for row in rows:
                # Apply limit if specified
                if limit is not None and row_count >= limit:
                    break

                csv_writer.writerow(row)
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
        self, sql: str, database: Any
    ) -> Generator[str, None, None]:
        """Execute query with streaming and yield CSV chunks."""
        _, limit = self._get_sql_and_limit()
        start_time = time.time()
        total_bytes = 0

        with db.session() as session:
            # Merge database to prevent DetachedInstanceError
            merged_database = session.merge(database)

            # Execute query with streaming
            with merged_database.get_sqla_engine() as engine:
                connection = engine.connect()

                try:
                    result_proxy = connection.execution_options(
                        stream_results=True
                    ).execute(text(sql))

                    columns = list(result_proxy.keys())

                    # Use StringIO with csv.writer for proper escaping
                    buffer = io.StringIO()
                    csv_writer = csv.writer(buffer, quoting=csv.QUOTE_MINIMAL)

                    # Write CSV header
                    header_data, header_bytes = self._write_csv_header(
                        columns, csv_writer, buffer
                    )
                    total_bytes += header_bytes
                    yield header_data

                    # Process rows and yield chunks
                    row_count = 0
                    for data_chunk, rows_processed, chunk_bytes in self._process_rows(
                        result_proxy, csv_writer, buffer, limit
                    ):
                        total_bytes += chunk_bytes
                        row_count = rows_processed
                        yield data_chunk

                    # Log completion
                    total_time = time.time() - start_time
                    total_mb = total_bytes / (1024 * 1024)
                    logger.info(
                        "SQL Lab streaming CSV completed: %s rows, %.1fMB in %.2fs",
                        f"{row_count:,}",
                        total_mb,
                        total_time,
                    )

                finally:
                    connection.close()

    def run(self) -> Callable[[], Generator[str, None, None]]:
        """
        Execute the streaming CSV export.

        Returns:
            A callable that returns a generator yielding CSV data chunks as strings.
            The callable is needed to maintain Flask app context during streaming.
        """
        # Load all Query attributes while session is still active
        # to avoid DetachedInstanceError
        assert self._query is not None
        sql, _ = self._get_sql_and_limit()
        database = self._query.database

        def csv_generator() -> Generator[str, None, None]:
            """Generator that yields CSV data from SQL Lab query results."""
            with self._current_app.app_context():
                try:
                    yield from self._execute_query_and_stream(sql, database)
                except Exception as e:
                    logger.error("Error in SQL Lab streaming CSV generator: %s", e)
                    import traceback

                    logger.error("Traceback: %s", traceback.format_exc())

                    # Send error marker for frontend to detect
                    error_marker = (
                        "__STREAM_ERROR__:Export failed. "
                        "Please try again in some time.\n"
                    )
                    yield error_marker

        return csv_generator
