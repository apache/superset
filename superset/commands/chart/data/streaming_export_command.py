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
"""Command for streaming CSV exports of chart data."""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

from superset.commands.streaming_export.base import BaseStreamingCSVExportCommand

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext


class StreamingCSVExportCommand(BaseStreamingCSVExportCommand):
    """
    Command to execute a streaming CSV export for chart data.

    This command handles chart-specific logic:
    - QueryContext validation
    - Datasource preparation and SQL generation
    - No row limit (exports all chart data)
    """

    def __init__(
        self,
        query_context: QueryContext,
        chunk_size: int = 1000,
    ):
        """
        Initialize the chart streaming export command.

        Args:
            query_context: The query context containing datasource and query details
            chunk_size: Number of rows to fetch per database query (default: 1000)
        """
        super().__init__(chunk_size)
        self._query_context = query_context

    def validate(self) -> None:
        """Validate permissions and query context."""
        self._query_context.raise_for_access()

    def _get_sql_and_database(self) -> tuple[str, Any]:
        """
        Get the SQL query and database for chart export.

        Returns:
            Tuple of (sql_query, database_object)
        """
        # Get datasource and generate SQL query
        # Note: datasource should already be attached to a session from query_context
        datasource = self._query_context.datasource
        query_obj = self._query_context.queries[0]
        sql_query = datasource.get_query_str(query_obj.to_dict())

        return sql_query, getattr(datasource, "database", None)

    def _get_row_limit(self) -> int | None:
        """
        Get the row limit for chart export.

        Returns:
            None (no limit for chart exports)
        """
        return None
