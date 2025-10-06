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
"""Command for streaming CSV exports of large datasets."""

from __future__ import annotations

import logging
import time
from typing import Callable, Generator, TYPE_CHECKING

from flask import current_app as app

from superset.commands.base import BaseCommand

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext

logger = logging.getLogger(__name__)


class StreamingCSVExportCommand(BaseCommand):
    """
    Command to execute a streaming CSV export.

    This command handles the business logic for:
    - Executing database queries with server-side cursors
    - Generating CSV data in chunks
    - Managing database connections
    - Buffering data for efficient streaming
    """

    def __init__(
        self,
        query_context: QueryContext,
        chunk_size: int = 1000,
    ):
        """
        Initialize the streaming export command.

        Args:
            query_context: The query context containing datasource and query details
            chunk_size: Number of rows to fetch per database query (default: 1000)
        """
        self._query_context = query_context
        self._chunk_size = chunk_size
        self._current_app = app._get_current_object()

    def validate(self) -> None:
        """Validate permissions and query context."""
        self._query_context.raise_for_access()

    def run(self) -> Callable[[], Generator[str, None, None]]:
        """
        Execute the streaming CSV export.

        Returns:
            A callable that returns a generator yielding CSV data chunks as strings.
            The callable is needed to maintain Flask app context during streaming.
        """

        def csv_generator() -> Generator[str, None, None]:
            """Generator that yields CSV data from database query."""
            with self._current_app.app_context():
                start_time = time.time()
                total_bytes = 0

                try:
                    from superset import db
                    from superset.connectors.sqla.models import SqlaTable

                    datasource = self._query_context.datasource

                    with db.session() as session:
                        if isinstance(datasource, SqlaTable):
                            datasource = session.merge(datasource)

                        query_obj = self._query_context.queries[0]
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
                                header_row = (
                                    ",".join(f'"{col}"' for col in columns) + "\n"
                                )
                                total_bytes += len(header_row.encode("utf-8"))
                                yield header_row

                                row_count = 0
                                buffer = []
                                buffer_size = 0
                                FLUSH_THRESHOLD = 65536  # 64KB

                                while True:
                                    rows = result_proxy.fetchmany(self._chunk_size)
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

        return csv_generator
