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

from flask import current_app as app

from superset import is_feature_enabled
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

    def _get_sql_and_database(self) -> tuple[str, Any, str | None, str | None]:
        """
        Get the SQL query, database, catalog, and schema for chart export.

        Returns:
            Tuple of (sql_query, database_object, catalog, schema)
        """
        # Get datasource and generate SQL query
        # Note: datasource should already be attached to a session from query_context
        datasource = self._query_context.datasource
        query_obj = self._query_context.queries[0]
        query_dict = query_obj.to_dict()

        # When ALLOW_FULL_CSV_EXPORT is enabled, raise the row limit so a
        # "full" export is not silently capped at SQL_MAX_ROW. The ceiling is
        # TABLE_VIZ_MAX_ROW_SERVER (a bounded, predictable maximum) rather than
        # truly unlimited.
        if is_feature_enabled("ALLOW_FULL_CSV_EXPORT"):
            query_dict["row_limit"] = app.config["TABLE_VIZ_MAX_ROW_SERVER"]

        # Use get_query_str_extended (single, clean statement) instead of
        # get_query_str, which returns a multi-statement string (prequeries +
        # main SQL joined by ";" with a trailing ";"). The base command runs the
        # SQL through SQLAlchemy text(), which only accepts a single statement,
        # so the multi-statement form fails on engines that emit prequeries
        # (e.g. PostgreSQL/Snowflake "SET search_path"). Prequeries still run
        # via the connect-event listener registered in Database.get_sqla_engine.
        # get_query_str_extended lives on ExploreMixin, not the Explorable
        # Protocol, so guard with getattr for datasources that lack it.
        get_extended = getattr(datasource, "get_query_str_extended", None)
        if callable(get_extended):
            sql_query = get_extended(query_dict).sql
        else:
            sql_query = datasource.get_query_str(query_dict)
        database = getattr(datasource, "database", None)
        catalog = getattr(datasource, "catalog", None)
        schema = getattr(datasource, "schema", None)

        return sql_query, database, catalog, schema

    def _get_row_limit(self) -> int | None:
        """
        Get the row limit for chart export.

        Returns:
            None (no limit for chart exports)
        """
        return None
