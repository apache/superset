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
"""Service for detecting datetime formats in dataset columns."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from flask import current_app

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.utils.decorators import transaction
from superset.utils.pandas import detect_datetime_format

if TYPE_CHECKING:
    from superset.models.core import Database

logger = logging.getLogger(__name__)


class DatetimeFormatDetector:
    """
    Service for detecting and storing datetime formats in dataset columns.

    This service samples data from datetime columns to detect their format,
    reducing the need for runtime format detection on every query.
    """

    def __init__(self, sample_size: int | None = None) -> None:
        """
        Initialize the datetime format detector.

        :param sample_size: Number of rows to sample for format detection
        """
        self.sample_size = sample_size or current_app.config.get(
            "DATETIME_FORMAT_DETECTION_SAMPLE_SIZE", 1000
        )

    def detect_column_format(
        self,
        dataset: SqlaTable,
        column: TableColumn,
    ) -> str | None:
        """
        Detect datetime format for a specific column.

        :param dataset: The dataset containing the column
        :param column: The column to detect format for
        :return: Detected format string or None if detection fails
        """
        if not column.is_temporal:
            logger.debug(
                "Column %s is not temporal, skipping format detection",
                column.column_name,
            )
            return None

        # Skip expression columns - they don't have stored data to sample
        if column.expression:
            logger.debug(
                "Column %s is an expression column, skipping format detection",
                column.column_name,
            )
            return None

        # Skip virtual datasets - they use SQL queries, not physical tables
        if dataset.is_virtual:
            logger.debug(
                "Dataset %s is virtual, skipping format detection for column %s",
                dataset.table_name,
                column.column_name,
            )
            return None

        try:
            # Build SQL query using database's identifier quoting
            # Note: Column and table names come from internal metadata, not user input
            database: Database = dataset.database

            # Get the database engine's dialect for proper identifier quoting
            with database.get_sqla_engine() as engine:
                dialect = engine.dialect

                # Quote identifiers using the dialect's identifier preparer
                column_name_quoted = dialect.identifier_preparer.quote(
                    column.column_name
                )
                table_name_quoted = dialect.identifier_preparer.quote(
                    dataset.table_name
                )

                if dataset.schema:
                    schema_quoted = dialect.identifier_preparer.quote(dataset.schema)
                    full_table = f"{schema_quoted}.{table_name_quoted}"
                else:
                    full_table = table_name_quoted

                # Build SQL query string with quoted identifiers
                # S608: false positive - using dialect's identifier preparer
                sql = (  # noqa: S608
                    f"SELECT {column_name_quoted} FROM {full_table} "  # noqa: S608
                    f"WHERE {column_name_quoted} IS NOT NULL"  # noqa: S608
                )

            # Apply database-specific LIMIT using apply_limit_to_sql
            # This handles different SQL dialects (LIMIT, TOP, FETCH FIRST, etc.)
            sql = database.apply_limit_to_sql(sql, limit=self.sample_size, force=True)

            # Execute query and get results
            df = database.get_df(sql, dataset.schema)

            if df.empty or column.column_name not in df.columns:
                logger.warning(
                    "No data returned for column %s in dataset %s",
                    column.column_name,
                    dataset.table_name,
                )
                return None

            # Detect format using existing utility
            series = df[column.column_name]
            detected_format = detect_datetime_format(series, self.sample_size)

            if detected_format:
                logger.info(
                    "Detected format '%s' for column %s.%s",
                    detected_format,
                    dataset.table_name,
                    column.column_name,
                )
            else:
                logger.warning(
                    "Could not detect format for column %s.%s",
                    dataset.table_name,
                    column.column_name,
                )

            return detected_format

        except Exception as ex:
            logger.exception(
                "Error detecting format for column %s.%s: %s",
                dataset.table_name,
                column.column_name,
                str(ex),
            )
            return None

    @transaction()
    def detect_all_formats(
        self,
        dataset: SqlaTable,
        force: bool = False,
    ) -> dict[str, str | None]:
        """
        Detect datetime formats for all temporal columns in a dataset.

        :param dataset: The dataset to process
        :param force: If True, re-detect even if format already exists
        :return: Dictionary mapping column names to detected formats
        """
        results: dict[str, str | None] = {}

        for column in dataset.columns:
            # Skip if not temporal
            if not column.is_temporal:
                continue

            # Skip if format already exists and not forcing re-detection
            if column.datetime_format and not force:
                logger.debug(
                    "Column %s.%s already has format '%s', skipping",
                    dataset.table_name,
                    column.column_name,
                    column.datetime_format,
                )
                results[column.column_name] = column.datetime_format
                continue

            # Detect and store format
            detected_format = self.detect_column_format(dataset, column)
            if detected_format:
                column.datetime_format = detected_format
                results[column.column_name] = detected_format
            else:
                results[column.column_name] = None

        # Log results
        if results:
            logger.info(
                "Detected formats for %d columns in dataset %s",
                len(results),
                dataset.table_name,
            )

        return results
