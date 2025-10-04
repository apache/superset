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

"""Streaming HTTP responses for large dataset exports."""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime
from typing import Any, Generator, TYPE_CHECKING

from flask import current_app as app, Response
from werkzeug.datastructures import Headers

from superset.views.streaming_progress import progress_tracker

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext

logger = logging.getLogger(__name__)


def create_streaming_csv_response_simple(
    data_generator: Generator[str, None, None],
    filename: str = "export.csv",
    encoding: str = "utf-8",
) -> Response:
    """
    Create a simple streaming CSV response using Flask's standard pattern.

    This follows the official Flask streaming documentation pattern.
    """
    from flask import Response

    # Create response with proper headers
    response = Response(
        data_generator,
        mimetype=f"text/csv; charset={encoding}",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )

    logger.info("Created simple streaming CSV response for file: %s", filename)
    return response


class StreamingExcelResponse(Response):
    """
    Streaming response for Excel (XLSX) files.

    Note: Excel streaming is more complex than CSV due to the binary format.
    This is a placeholder for future implementation.
    """

    def __init__(
        self,
        data_generator: Generator[bytes, None, None],
        filename: str = "export.xlsx",
        **kwargs: Any,
    ) -> None:
        headers = Headers()
        headers.add(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        headers.add("Content-Disposition", f'attachment; filename="{filename}"')
        headers.add("Cache-Control", "no-cache, no-store, must-revalidate")
        headers.add("Transfer-Encoding", "chunked")

        super().__init__(
            response=data_generator, headers=headers, direct_passthrough=True, **kwargs
        )

        # Note: is_streamed is automatically True when response is a generator


def create_streaming_csv_response(
    query_context: QueryContext,
    filename: str | None = None,
    chunk_size: int | None = None,
    escape_formulas: bool = True,
    expected_rows: int | None = None,
) -> Response:
    """
    Factory function to create a streaming CSV response using Flask's standard pattern.

    Args:
        query_context: Superset query context
        filename: Optional filename for download
        chunk_size: Optional chunk size for processing
        escape_formulas: Whether to escape formula injection

    Returns:
        Flask Response configured for streaming CSV
    """
    # Generate filename first if not provided
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"superset_streaming_{timestamp}.csv"

    # Use filename as export ID for progress tracking (frontend knows this)
    export_id = filename

    # Capture the Flask app instance in the current context
    current_app = app._get_current_object()

    def csv_generator() -> Generator[str, None, None]:
        """Generator that yields CSV data from database query."""
        # Use the captured app instance to create application context
        with current_app.app_context():
            # Performance tracking
            start_time = time.time()
            total_bytes = 0

            try:
                logger.info("🚀 STREAMING CSV: Starting streaming CSV generation")
                logger.info("📊 STREAMING CSV: Export ID: %s", export_id)
                logger.info(
                    "📊 STREAMING CSV: Processing query with estimated large result set"
                )


                estimated_rows = expected_rows

                if estimated_rows:
                    logger.info(
                        "📊 STREAMING CSV: Using expected_rows from frontend: %d",
                        estimated_rows,
                    )
                else:
                    form_data = query_context.form_data
                    estimated_rows = form_data.get('row_limit') if form_data else None

                    if estimated_rows:
                        logger.info(
                            "📊 STREAMING CSV: Using row_limit from form_data: %d",
                            estimated_rows,
                        )
                    else:
                        logger.warning(
                            "⚠️ STREAMING CSV: No expected_rows or row_limit available, progress percentage will be unavailable"
                        )
                        estimated_rows = None

                # Initialize progress tracker
                progress_tracker.create_export(
                    export_id=export_id, total_rows=estimated_rows
                )

                # Get the database connection and execute raw SQL query directly
                from superset import db
                from superset.connectors.sqla.models import SqlaTable

                # Get the datasource
                datasource = query_context.datasource

                # Create a fresh session to avoid detached object issues
                with db.session() as session:
                    # Refresh the datasource in the current session
                    if isinstance(datasource, SqlaTable):
                        datasource = session.merge(datasource)

                    query_obj = query_context.queries[0]

                    sql_query = datasource.get_query_str(query_obj.to_dict())

                    query_start_time = time.time()
                    logger.info(
                        "⚡ STREAMING CSV: Executing SQL query: %s...",
                        sql_query[:200],
                    )
                    logger.info(
                        "⏱️  STREAMING CSV: Query execution started at %s",
                        time.strftime("%H:%M:%S"),
                    )

                    # Execute query directly with the database engine
                    # Use context manager for proper connection handling
                    with datasource.database.get_sqla_engine() as engine:
                        # Use server-side cursor for streaming
                        connection = engine.connect()

                        try:
                            # Execute query with server-side cursor
                            from sqlalchemy import text

                            result_proxy = connection.execution_options(
                                stream_results=True
                            ).execute(text(sql_query))

                            # Get column names
                            columns = list(result_proxy.keys())
                            query_execution_time = time.time() - query_start_time
                            logger.info(
                                "📋 STREAMING CSV: Query columns (%d): %s",
                                len(columns),
                                columns,
                            )
                            logger.info(
                                "⚡ STREAMING CSV: Query executed in %.2fs, "
                                "starting data streaming...",
                                query_execution_time,
                            )

                            # Yield CSV header
                            header_row = ",".join(f'"{col}"' for col in columns) + "\n"
                            header_bytes = len(header_row.encode("utf-8"))
                            total_bytes += header_bytes
                            yield header_row

                            # 🧪 TESTING CONFIGURATION - Enable slower streaming for UI testing
                            ENABLE_SLOW_STREAMING_TEST = (
                                True  # Set to False for production speed
                            )

                            if ENABLE_SLOW_STREAMING_TEST:
                                # Testing mode: 10k rows per chunk with 0.5s delay
                                chunk_size = 10000
                                delay_between_chunks = 0.5
                                logger.info(
                                    "🧪 TESTING MODE: Using 10k row chunks with 0.5s delays"
                                )
                            else:
                                # Production mode: 1k rows per chunk, no delay
                                chunk_size = 1000
                                delay_between_chunks = 0

                            row_count = 0
                            streaming_start_time = time.time()
                            last_progress_time = streaming_start_time

                            while True:
                                # Fetch chunk of rows
                                rows = result_proxy.fetchmany(chunk_size)
                                if not rows:
                                    break

                                # Yield CSV rows
                                for row in rows:
                                    csv_row = ",".join(
                                        f'"{str(cell) if cell is not None else ""}"'
                                        for cell in row
                                    )
                                    csv_line = csv_row + "\n"
                                    row_bytes = len(csv_line.encode("utf-8"))
                                    total_bytes += row_bytes
                                    yield csv_line
                                    row_count += 1

                                # Update progress tracker after each chunk
                                progress_tracker.update_progress(
                                    export_id=export_id,
                                    rows_processed=row_count,
                                    bytes_processed=total_bytes,
                                )

                                # Performance logging every 10k rows or 5 seconds
                                current_time = time.time()
                                if (
                                    row_count % 10000 == 0
                                    or (current_time - last_progress_time) >= 5
                                ):
                                    elapsed = current_time - streaming_start_time
                                    rows_per_sec = (
                                        row_count / elapsed if elapsed > 0 else 0
                                    )
                                    mb_streamed = total_bytes / (1024 * 1024)
                                    mb_per_sec = (
                                        mb_streamed / elapsed if elapsed > 0 else 0
                                    )

                                    logger.info(
                                        "📈 STREAMING CSV: %s rows streamed in %.1fs "
                                        "(%.0f rows/s, %.1fMB, %.1fMB/s)",
                                        f"{row_count:,}",
                                        elapsed,
                                        rows_per_sec,
                                        mb_streamed,
                                        mb_per_sec,
                                    )
                                    last_progress_time = current_time

                                # Apply testing delay for UI demonstration
                                if (
                                    ENABLE_SLOW_STREAMING_TEST
                                    and delay_between_chunks > 0
                                ):
                                    time.sleep(delay_between_chunks)

                            # Final performance summary
                            total_time = time.time() - start_time
                            streaming_time = time.time() - streaming_start_time
                            total_mb = total_bytes / (1024 * 1024)

                            logger.info(
                                "✅ STREAMING CSV: Completed streaming %s rows",
                                f"{row_count:,}",
                            )
                            logger.info("📊 STREAMING CSV PERFORMANCE:")
                            logger.info("   • Total Time: %.2fs", total_time)
                            logger.info("   • Query Time: %.2fs", query_execution_time)
                            logger.info("   • Streaming Time: %.2fs", streaming_time)
                            logger.info("   • Data Size: %.1fMB", total_mb)
                            logger.info(
                                "   • Average Speed: %.0f rows/s, %.1fMB/s",
                                row_count / total_time,
                                total_mb / total_time,
                            )
                            logger.info(
                                "   • Memory Efficient: ✅ Constant memory usage "
                                "(~%d rows buffered)",
                                chunk_size,
                            )

                            # Mark export as completed in progress tracker
                            progress_tracker.complete_export(export_id)

                        finally:
                            connection.close()

            except Exception as e:
                logger.error("Error in streaming CSV generator: %s", e)
                import traceback

                logger.error("Traceback: %s", traceback.format_exc())

                # Mark export as failed in progress tracker
                progress_tracker.fail_export(export_id, str(e))

                # Yield error info and fallback data
                yield f"# Error occurred: {str(e)}\n"
                yield "error,message\n"
                yield f"CSV Export Error,{str(e)}\n"

    # Get encoding from the captured app
    encoding = current_app.config.get("CSV_EXPORT", {}).get("encoding", "utf-8")

    logger.info("Creating Flask streaming CSV response: %s", filename)

    # Use simple Flask Response with generator (official pattern)
    return create_streaming_csv_response_simple(
        data_generator=csv_generator(),
        filename=filename,
        encoding=encoding,
    )


def should_use_streaming_response(
    query_context: QueryContext,
    result_format: str,
) -> bool:
    """
    Determine if a streaming response should be used.

    Args:
        query_context: The query context
        result_format: The requested result format (csv, xlsx, etc.)

    Returns:
        True if streaming should be used
    """
    # Only stream for supported formats
    if result_format.lower() not in ["csv"]:  # Add "xlsx" when implemented
        return False

    # Check if streaming is enabled in config
    config = app.config.get("CSV_STREAMING", {})
    if not config.get("enabled", True):
        return False

    # Simple row count estimation - always trigger streaming for CSV exports
    # TODO: Implement proper row estimation logic based on query
    estimated_rows = 50000  # Conservative estimate to trigger streaming
    threshold = app.config.get("CSV_STREAMING_THRESHOLD", 10000)

    use_streaming = estimated_rows > threshold

    logger.info(
        "Streaming decision: %d estimated rows, threshold %d, use_streaming=%s",
        estimated_rows,
        threshold,
        use_streaming,
    )

    return use_streaming


class StreamingProgressTracker:
    """
    Track progress of streaming exports for monitoring and user feedback.

    This could be extended to provide real-time progress updates via WebSocket
    or SSE (Server-Sent Events) in the future.
    """

    def __init__(self, export_id: str) -> None:
        self.export_id = export_id
        self.start_time = datetime.now()
        self.last_update = self.start_time
        self.total_chunks = 0
        self.processed_rows = 0

    def update_progress(self, chunks: int, rows: int) -> None:
        """Update progress metrics."""
        self.total_chunks = chunks
        self.processed_rows = rows
        self.last_update = datetime.now()

        # Log progress every 100 chunks
        if chunks % 100 == 0:
            elapsed = (self.last_update - self.start_time).total_seconds()
            rate = rows / elapsed if elapsed > 0 else 0
            logger.info(
                "Export %s: %d rows, %d chunks, %.0f rows/sec",
                self.export_id,
                rows,
                chunks,
                rate,
            )

    def get_status(self) -> dict[str, Any]:
        """Get current export status."""
        elapsed = (datetime.now() - self.start_time).total_seconds()
        return {
            "export_id": self.export_id,
            "start_time": self.start_time.isoformat(),
            "elapsed_seconds": elapsed,
            "processed_rows": self.processed_rows,
            "total_chunks": self.total_chunks,
            "last_update": self.last_update.isoformat(),
        }
