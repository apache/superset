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
from datetime import datetime
from typing import Any, Generator, TYPE_CHECKING

from flask import current_app as app, Response

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

    # Create response with proper headers to disable buffering
    # CRITICAL: Set direct_passthrough=False to ensure Flask actually iterates the generator
    response = Response(
        data_generator,
        mimetype=f"text/csv; charset={encoding}",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "X-Superset-Streaming": "true",  # Identify streaming responses
        },
        direct_passthrough=False,  # Flask must iterate generator, not pass to WSGI directly
    )

    # Force chunked transfer encoding (critical for streaming)
    response.implicit_sequence_conversion = False

    return response


def create_streaming_csv_response(
    query_context: QueryContext,
    filename: str | None = None,
    chunk_size: int | None = None,
    escape_formulas: bool = True,
    expected_rows: int | None = None,
) -> Response:
    """
    Factory function to create a streaming CSV response.

    Args:
        query_context: Superset query context
        filename: Optional filename for download
        chunk_size: Optional chunk size for processing (default: 1000)
        escape_formulas: Whether to escape formula injection (not implemented)
        expected_rows: Expected number of rows for progress tracking

    Returns:
        Flask Response configured for streaming CSV
    """
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"superset_streaming_{timestamp}.csv"

    if chunk_size is None:
        chunk_size = 1000

    current_app = app._get_current_object()

    def csv_generator() -> Generator[str, None, None]:
        """Generator that yields CSV data from database query."""
        with current_app.app_context():
            start_time = time.time()
            total_bytes = 0

            try:
                from superset import db
                from superset.connectors.sqla.models import SqlaTable

                # Get the datasource
                datasource = query_context.datasource

                with db.session() as session:
                    if isinstance(datasource, SqlaTable):
                        datasource = session.merge(datasource)

                    query_obj = query_context.queries[0]
                    sql_query = datasource.get_query_str(query_obj.to_dict())

                    with datasource.database.get_sqla_engine() as engine:
                        connection = engine.connect()

                        try:
                            from sqlalchemy import text

                            result_proxy = connection.execution_options(
                                stream_results=True
                            ).execute(text(sql_query))

                            columns = list(result_proxy.keys())

                            # Yield CSV header
                            header_row = ",".join(f'"{col}"' for col in columns) + "\n"
                            total_bytes += len(header_row.encode("utf-8"))
                            yield header_row

                            row_count = 0
                            buffer = []
                            buffer_size = 0
                            FLUSH_THRESHOLD = 65536  # 64KB

                            while True:
                                rows = result_proxy.fetchmany(chunk_size)
                                if not rows:
                                    break

                                for row in rows:
                                    csv_row = ",".join(
                                        f'"{str(cell) if cell is not None else ""}"'
                                        for cell in row
                                    )
                                    csv_line = csv_row + "\n"
                                    row_bytes = len(csv_line.encode("utf-8"))
                                    total_bytes += row_bytes
                                    row_count += 1

                                    buffer.append(csv_line)
                                    buffer_size += row_bytes

                                    if buffer_size >= FLUSH_THRESHOLD:
                                        yield "".join(buffer)
                                        buffer = []
                                        buffer_size = 0

                            # Flush remaining buffer
                            if buffer:
                                yield "".join(buffer)

                            # Log completion
                            total_time = time.time() - start_time
                            total_mb = total_bytes / (1024 * 1024)
                            logger.info(
                                "Streaming CSV completed: %s rows, %.1fMB in %.2fs",
                                f"{row_count:,}",
                                total_mb,
                                total_time,
                            )

                        finally:
                            connection.close()

            except Exception as e:
                logger.error("Error in streaming CSV generator: %s", e)
                import traceback

                logger.error("Traceback: %s", traceback.format_exc())

                # Yield error info and fallback data
                yield f"# Error occurred: {str(e)}\n"
                yield "error,message\n"
                yield f"CSV Export Error,{str(e)}\n"

    encoding = current_app.config.get("CSV_EXPORT", {}).get("encoding", "utf-8")

    return create_streaming_csv_response_simple(
        data_generator=csv_generator(),
        filename=filename,
        encoding=encoding,
    )


